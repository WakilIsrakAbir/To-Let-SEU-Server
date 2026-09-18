import { Request, Response, NextFunction } from 'express';
import { Post, IPostDocument } from '../models/Post.model';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import cloudinary from '../config/cloudinary';

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
      author: req.user._id,
      department: req.body.department || req.user.department,
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

    // Area filter (case-insensitive substring or match)
    if (area && typeof area === 'string' && area !== 'All') {
      const areaList = area.split(',').map((a) => a.trim());
      filterQuery.area = { $in: areaList.map((a) => new RegExp(a, 'i')) };
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

    // Text search if provided
    if (search && typeof search === 'string') {
      filterQuery.$text = { $search: search };
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
        .limit(limitNum),
      Post.countDocuments(filterQuery),
    ]);

    const totalPages = Math.ceil(totalPosts / limitNum);

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

    // Delete media assets from Cloudinary in background
    if (post.media?.images?.length) {
      post.media.images.forEach((img) => {
        cloudinary.uploader.destroy(img.publicId).catch(() => {});
      });
    }
    if (post.media?.video?.publicId) {
      cloudinary.uploader
        .destroy(post.media.video.publicId, { resource_type: 'video' })
        .catch(() => {});
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
