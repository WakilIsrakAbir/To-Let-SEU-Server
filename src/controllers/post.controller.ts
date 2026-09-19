import { Request, Response, NextFunction } from 'express';
import { Post, IPostDocument } from '../models/Post.model';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import cloudinary from '../config/cloudinary';
import { deleteMediaFromCloudinary } from '../utils/cloudinaryCleanup';

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
      title: req.body.title?.trim() || 'Bachelor Seat / Room',
      department: req.body.department || req.user.department || 'General',
      contactNumber: req.body.contactNumber || req.user.phone || 'N/A',
      area: req.body.area || 'Tejgaon (Near SEU Campus)',
      addressDetails: req.body.addressDetails || 'Near Campus Area',
      rentAmount: Number(req.body.rentAmount) || 0,
      seatCount: Number(req.body.seatCount) || 1,
      gender: req.body.gender || 'Male',
      availableFromMonth: req.body.availableFromMonth || 'Immediate',
      description: req.body.description || '',
      author: req.user._id,
    };

    const post = await Post.create(postData);
    await post.populate('author', 'name email department avatarUrl phone isVerifiedStudent');

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
    const {
      area,
      gender,
      minRent,
      maxRent,
      isNegotiable,
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
        'Tejgaon',
        'Mohakhali',
        'Banani',
        'Nakhalpara',
        'Farmgate',
        'Bijoy Sarani',
        'Monipuripara',
        'Panthapath',
        'Mirpur',
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

    if (isNegotiable === 'true') {
      filterQuery.rentType = 'negotiable';
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

    res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Rental posts retrieved successfully.',
      data: {
        posts,
        pagination: {
          totalPosts,
          totalPages,
          currentPage: pageNum,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
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

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Rental post and associated media deleted successfully.',
    });
  } catch (error) {
    return next(error);
  }
};
