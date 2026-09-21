import { Request, Response, NextFunction } from 'express';
import { Post, IPostDocument } from '../models/Post.model';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import cloudinary from '../config/cloudinary';
import { deleteMediaFromCloudinary } from '../utils/cloudinaryCleanup';

// High-performance in-memory cache for fast response times (<10ms)
interface CacheEntry {
  data: any;
  expiry: number;
}

const postCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 45 * 1000; // 45 seconds TTL

export const clearPostCache = () => {
  postCache.clear();
};

export const createPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required to post an ad.'));
    }

    const postData = {
      ...req.body,
      title: req.body.title?.trim() || `${req.body.gender || 'Bachelor'} ${req.body.roomType || 'Seat'} in ${req.body.area || 'SEU Area'}`,
      department: req.body.department || req.user.department || 'General',
      contactNumber: req.body.contactNumber || req.user.phone || 'N/A',
      whatsappNumber: req.body.whatsappNumber || req.body.contactNumber || req.user.phone,
      area: req.body.area,
      addressDetails: req.body.addressDetails || 'Near Campus Area',
      rentAmount: Number(req.body.rentAmount) || 0,
      seatCount: Number(req.body.seatCount) || 1,
      gender: req.body.gender,
      availableFromMonth: req.body.availableFromMonth,
      roomType: req.body.roomType,
      description: req.body.description || '',
      author: req.user._id,
    };

    const post = await Post.create(postData);
    await post.populate('author', 'name email department avatarUrl phone isVerifiedStudent');

    // Invalidate cached post lists so the new post appears immediately
    clearPostCache();

    return sendResponse({
      res,
      statusCode: 201,
      message: 'Rental post published successfully!',
      data: { post },
    });
  } catch (error) {
    return next(error);
  }
};

export const getPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Check in-memory cache for instant response (<10ms)
    const cacheKey = req.originalUrl || req.url;
    const cachedEntry = postCache.get(cacheKey);
    if (cachedEntry && Date.now() < cachedEntry.expiry) {
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      return sendResponse({
        res,
        statusCode: 200,
        message: 'Rental posts retrieved successfully.',
        data: cachedEntry.data,
      });
    }

    const {
      area,
      gender,
      minRent,
      maxRent,
      month,
      roomType,
      amenities,
      sort,
      page = 1,
      limit = 10,
      search,
    } = req.query;

    const filterQuery: any = { status: 'active' };

    // Area filter (handles predefined campus areas and "Other" / custom areas)
    if (area && typeof area === 'string' && area !== 'All') {
      const areaList = area.split(',').map((a) => a.trim()).filter(Boolean);
      const hasOther = areaList.some((a) => a.toLowerCase() === 'other');
      const specificAreas = areaList.filter((a) => a.toLowerCase() !== 'other');

      const STANDARD_CAMPUS_AREAS = [
        'East Nakhalpara',
        'West Nakhalpara',
        'Mohakhali',
        'Banani',
        'Begunbari',
        'Kunipara',
        'Modhubag',
        'Mogbazar',
        'Niketon',
        'Niketon Bazar Gate',
        'Farmgate',
        'Bijoy Sarani',
        'Panthapath',
        'Rampura',
        'Badda',
        'Mirpur',
        'Uttara',
        'Khilkhet',
        'Nikunja',
      ];

      const orBranches: any[] = [];

      if (specificAreas.length > 0) {
        const specificRegexes = specificAreas.map(
          (a) => new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        );
        orBranches.push({ area: { $in: specificRegexes } });
      }

      if (hasOther) {
        const standardRegexes = STANDARD_CAMPUS_AREAS.map(
          (name) => new RegExp(name, 'i')
        );
        // Matches posts with area "Other", "Other (...)", or any area outside standard campus areas
        orBranches.push({ area: /Other/i });
        orBranches.push({
          $and: standardRegexes.map((reg) => ({ area: { $not: reg } })),
        });
      }

      if (orBranches.length === 1) {
        Object.assign(filterQuery, orBranches[0]);
      } else if (orBranches.length > 1) {
        filterQuery.$or = orBranches;
      }
    }

    // Gender filter
    if (gender && (gender === 'Male' || gender === 'Female')) {
      filterQuery.gender = gender;
    }

    // Rent filter
    if (minRent || maxRent) {
      filterQuery.rentAmount = {};
      if (minRent) filterQuery.rentAmount.$gte = Number(minRent);
      if (maxRent) filterQuery.rentAmount.$lte = Number(maxRent);
    }

    // Month filter
    if (month && typeof month === 'string' && month !== 'All') {
      filterQuery.availableFromMonth = new RegExp(month, 'i');
    }

    // Room Type filter
    if (roomType && typeof roomType === 'string' && roomType !== 'All') {
      filterQuery.roomType = roomType;
    }

    // Amenities filter (e.g. amenities=wifi,fridge,khalaMaid)
    if (amenities && typeof amenities === 'string') {
      const amenityKeys = amenities.split(',');
      amenityKeys.forEach((key) => {
        filterQuery[`amenities.${key.trim()}`] = true;
      });
    }

    // Flexible regex search across title, description, area, addressDetails, roomType
    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { title: searchRegex },
        { description: searchRegex },
        { area: searchRegex },
        { addressDetails: searchRegex },
        { roomType: searchRegex },
        { department: searchRegex },
      ];

      if (filterQuery.$or) {
        filterQuery.$and = [
          { $or: filterQuery.$or },
          { $or: searchConditions },
        ];
        delete filterQuery.$or;
      } else {
        filterQuery.$or = searchConditions;
      }
    }

    // Sorting
    let sortOptions: any = { createdAt: -1 }; // Default newest
    if (sort === 'rent_asc') {
      sortOptions = { rentAmount: 1 };
    } else if (sort === 'rent_desc') {
      sortOptions = { rentAmount: -1 };
    } else if (sort === 'views') {
      sortOptions = { viewsCount: -1 };
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const [posts, totalPosts] = await Promise.all([
      Post.find(filterQuery)
        .populate('author', 'name email department avatarUrl phone isVerifiedStudent')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Post.countDocuments(filterQuery),
    ]);

    const totalPages = Math.ceil(totalPosts / limitNum);

    const responsePayload = {
      posts,
      pagination: {
        totalPosts,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };

    // Store in in-memory cache (prune if exceeds 150 items to keep RAM low)
    if (postCache.size > 150) {
      postCache.clear();
    }
    postCache.set(cacheKey, {
      data: responsePayload,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    // Vercel Edge Network will cache this at the Edge CDN for 30s
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Rental posts retrieved successfully.',
      data: responsePayload,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPostById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const post = await Post.findByIdAndUpdate(
      id,
      { $inc: { viewsCount: 1 } },
      { new: true }
    ).populate('author', 'name email department avatarUrl phone isVerifiedStudent');

    if (!post) {
      return next(new ApiError(404, 'Rental post not found.'));
    }

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Post retrieved successfully.',
      data: { post },
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyPosts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    const posts = await Post.find({ author: req.user._id }).sort({
      createdAt: -1,
    });

    return sendResponse({
      res,
      statusCode: 200,
      message: 'My posts retrieved successfully.',
      data: { posts },
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    const { id } = req.params;
    const post = await Post.findById(id);

    if (!post) {
      return next(new ApiError(404, 'Post not found.'));
    }

    // Verify ownership or admin
    const isOwner = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return next(
        new ApiError(403, 'Forbidden: You are not authorized to edit this post.')
      );
    }

    const updatedPost = await Post.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate('author', 'name email department avatarUrl phone isVerifiedStudent');

    // Invalidate cached post lists
    clearPostCache();

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Post updated successfully.',
      data: { post: updatedPost },
    });
  } catch (error) {
    return next(error);
  }
};

export const deletePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    const { id } = req.params;
    const post = await Post.findById(id);

    if (!post) {
      return next(new ApiError(404, 'Post not found.'));
    }

    const isOwner = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return next(
        new ApiError(403, 'Forbidden: You are not authorized to delete this post.')
      );
    }

    // Robustly delete all media assets (images + video) from Cloudinary
    if (post.media) {
      await deleteMediaFromCloudinary(post.media);
    }

    await Post.findByIdAndDelete(id);

    // Invalidate cached post lists
    clearPostCache();

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Rental posts and associated media deleted successfully.',
    });
  } catch (error) {
    return next(error);
  }
};
