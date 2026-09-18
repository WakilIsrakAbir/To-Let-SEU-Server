import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.model';
import { Post } from '../models/Post.model';
import { sendResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import cloudinary from '../config/cloudinary';

export const getAdminStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [totalUsers, totalPosts, activePosts, bookedPosts] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments(),
      Post.countDocuments({ status: 'active' }),
      Post.countDocuments({ status: 'booked' }),
    ]);

    // Area breakdown aggregate
    const areaBreakdown = await Post.aggregate([
      { $group: { _id: '$area', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Admin statistics loaded.',
      data: {
        totalUsers,
        totalPosts,
        activePosts,
        bookedPosts,
        areaBreakdown,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllUsers = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    return sendResponse({
      res,
      statusCode: 200,
      message: 'All registered users loaded.',
      data: { users },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'moderator', 'admin'].includes(role)) {
      return next(new ApiError(400, 'Invalid user role specified.'));
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    );

    if (!updatedUser) {
      return next(new ApiError(404, 'User not found.'));
    }

    return sendResponse({
      res,
      statusCode: 200,
      message: `User promoted/updated to ${role}.`,
      data: { user: updatedUser },
    });
  } catch (error) {
    return next(error);
  }
};

export const toggleVerifyStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return next(new ApiError(404, 'User not found.'));
    }

    user.isVerifiedStudent = !user.isVerifiedStudent;
    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      message: `Student verification set to ${user.isVerifiedStudent}.`,
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return next(new ApiError(404, 'User not found.'));
    }

    // Delete user's posts
    await Post.deleteMany({ author: userId });
    await User.findByIdAndDelete(userId);

    return sendResponse({
      res,
      statusCode: 200,
      message: 'User and all their posts have been deleted.',
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAnyPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);

    if (!post) {
      return next(new ApiError(404, 'Post not found.'));
    }

    // Purge media from Cloudinary
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

    await Post.findByIdAndDelete(postId);

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Post deleted by Admin successfully.',
    });
  } catch (error) {
    return next(error);
  }
};
