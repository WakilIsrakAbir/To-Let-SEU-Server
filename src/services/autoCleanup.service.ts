import { Post } from '../models/Post.model';
import { deleteMediaFromCloudinary } from '../utils/cloudinaryCleanup';

let lastCleanupTimestamp: number = 0;
let isCleanupRunning: boolean = false;

export interface ICleanupResult {
  success: boolean;
  message: string;
  deletedPostsCount: number;
  deletedImagesCount: number;
  deletedVideosCount: number;
  olderThanDays: number;
  thresholdDate: string;
  durationMs: number;
}

/**
 * Automatically purges posts that are older than 60 days (2 months).
 * Permanently destroys all Cloudinary image and video assets first, then removes the post documents.
 * User accounts are strictly preserved and never deleted by this process.
 */
export const cleanupExpiredPosts = async (days: number = 60): Promise<ICleanupResult> => {
  if (isCleanupRunning) {
    return {
      success: true,
      message: 'Cleanup already running in background.',
      deletedPostsCount: 0,
      deletedImagesCount: 0,
      deletedVideosCount: 0,
      olderThanDays: days,
      thresholdDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      durationMs: 0,
    };
  }

  isCleanupRunning = true;
  const startTime = Date.now();
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let totalImagesDeleted = 0;
  let totalVideosDeleted = 0;
  let totalPostsDeleted = 0;

  try {
    // Find all posts older than threshold
    const expiredPosts = await Post.find({
      createdAt: { $lt: threshold },
    }).select('_id title media createdAt');

    if (expiredPosts.length > 0) {
      console.log(`[AutoCleanup] Found ${expiredPosts.length} posts older than ${days} days. Initiating Cloudinary & DB purge...`);

      for (const post of expiredPosts) {
        if (post.media) {
          const { deletedImages, deletedVideos } = await deleteMediaFromCloudinary(post.media);
          totalImagesDeleted += deletedImages;
          totalVideosDeleted += deletedVideos;
        }
      }

      const postIds = expiredPosts.map((p) => p._id);
      const deleteResult = await Post.deleteMany({ _id: { $in: postIds } });
      totalPostsDeleted = deleteResult.deletedCount || expiredPosts.length;

      console.log(
        `[AutoCleanup] Successfully purged ${totalPostsDeleted} expired posts, ${totalImagesDeleted} Cloudinary images, and ${totalVideosDeleted} Cloudinary videos.`
      );
    } else {
      console.log(`[AutoCleanup] Check completed: No posts older than ${days} days found.`);
    }

    lastCleanupTimestamp = Date.now();
  } catch (error: any) {
    console.error('[AutoCleanup] Error during auto-cleanup routine:', error?.message);
    throw error;
  } finally {
    isCleanupRunning = false;
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    message: `Purged ${totalPostsDeleted} posts older than ${days} days and cleaned Cloudinary media.`,
    deletedPostsCount: totalPostsDeleted,
    deletedImagesCount: totalImagesDeleted,
    deletedVideosCount: totalVideosDeleted,
    olderThanDays: days,
    thresholdDate: threshold.toISOString(),
    durationMs,
  };
};

/**
 * Lazy request-time check: triggers the 60-day auto cleanup at most once every 24 hours.
 * Safe to execute during incoming HTTP requests without blocking the response.
 */
export const checkAndRunDailyCleanup = () => {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (now - lastCleanupTimestamp > TWENTY_FOUR_HOURS_MS && !isCleanupRunning) {
    // Run asynchronously in background
    cleanupExpiredPosts(60).catch((err) => {
      console.warn('[AutoCleanup] Background daily cleanup error:', err?.message);
    });
  }
};
