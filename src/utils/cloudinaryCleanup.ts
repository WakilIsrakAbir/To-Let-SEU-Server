import cloudinary from '../config/cloudinary';

export interface IMediaPayload {
  images?: Array<{
    url?: string;
    publicId?: string;
  }>;
  video?: {
    url?: string;
    publicId?: string;
  };
}

/**
 * Robustly deletes all image and video assets from Cloudinary associated with a post.
 * Uses Promise.allSettled to ensure all assets are attempted even if one fails.
 */
export const deleteMediaFromCloudinary = async (media?: IMediaPayload): Promise<{
  deletedImages: number;
  deletedVideos: number;
}> => {
  let deletedImages = 0;
  let deletedVideos = 0;

  if (!media) {
    return { deletedImages, deletedVideos };
  }

  const tasks: Promise<any>[] = [];

  // Delete images
  if (media.images && Array.isArray(media.images)) {
    for (const img of media.images) {
      if (img?.publicId) {
        tasks.push(
          cloudinary.uploader
            .destroy(img.publicId, { resource_type: 'image' })
            .then((result) => {
              if (result?.result === 'ok') deletedImages++;
            })
            .catch((err) => {
              console.warn(`[Cloudinary] Failed to delete image ${img.publicId}:`, err?.message);
            })
        );
      }
    }
  }

  // Delete video
  if (media.video?.publicId) {
    tasks.push(
      cloudinary.uploader
        .destroy(media.video.publicId, { resource_type: 'video' })
        .then((result) => {
          if (result?.result === 'ok') deletedVideos++;
        })
        .catch((err) => {
          console.warn(`[Cloudinary] Failed to delete video ${media.video?.publicId}:`, err?.message);
        })
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  return { deletedImages, deletedVideos };
};
