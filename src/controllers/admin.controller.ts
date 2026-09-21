import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.model';
import { Post } from '../models/Post.model';
import { sendResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { deleteMediaFromCloudinary } from '../utils/cloudinaryCleanup';
import { cleanupExpiredPosts } from '../services/autoCleanup.service';
import { clearPostCache } from './post.controller';

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

    // Daily posts aggregate for the past 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const dailyAggregate = await Post.aggregate([
      {
        $match: {
          createdAt: { $gte: fourteenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Fill in zero counts for any date without posts
    const dateMap = new Map<string, number>();
    dailyAggregate.forEach((item) => {
      dateMap.set(item._id, item.count);
    });

    const dailyPostStats: Array<{ date: string; count: number; label: string; weekday: string }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = dateMap.get(dateStr) || 0;
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      dailyPostStats.push({ date: dateStr, count, label, weekday });
    }

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
        dailyPostStats,
        autoPurgeDays: 60,
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

    // Find and delete all posts authored by this user, including their Cloudinary media
    const userPosts = await Post.find({ author: userId });
    for (const post of userPosts) {
      if (post.media) {
        await deleteMediaFromCloudinary(post.media);
      }
    }

    await Post.deleteMany({ author: userId });
    await User.findByIdAndDelete(userId);

    clearPostCache();

    return sendResponse({
      res,
      statusCode: 200,
      message: 'User and all their posts and Cloudinary assets have been permanently deleted.',
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

    // Purge media safely from Cloudinary
    if (post.media) {
      await deleteMediaFromCloudinary(post.media);
    }

    await Post.findByIdAndDelete(postId);

    clearPostCache();

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Post and associated Cloudinary assets deleted by Admin successfully.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Manually trigger or test the expired posts auto-cleanup
 */
export const triggerExpiredPostsCleanup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const days =
      req.body?.days !== undefined && !isNaN(Number(req.body.days))
        ? Number(req.body.days)
        : 60;
    const result = await cleanupExpiredPosts(days);

    return sendResponse({
      res,
      statusCode: 200,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get count preview of posts that match the auto-purge threshold
 */
export const getExpiredPostsPreview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const days =
      req.query?.days !== undefined && !isNaN(Number(req.query.days))
        ? Number(req.query.days)
        : 60;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const matchCount = await Post.countDocuments({
      createdAt: { $lt: threshold },
    });

    return sendResponse({
      res,
      statusCode: 200,
      message: `Preview of expired posts (${days} days threshold).`,
      data: {
        days,
        thresholdDate: threshold.toISOString(),
        matchCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};
