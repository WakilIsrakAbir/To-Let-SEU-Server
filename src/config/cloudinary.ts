import { v2 as cloudinary } from 'cloudinary';
import { ENV } from './env';

cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
  secure: true,
});

export const CLOUDINARY_FOLDERS = {
  ROOT: 'to-let-seu',
  POST_IMAGES: 'to-let-seu/posts/images',
  POST_VIDEOS: 'to-let-seu/posts/videos',
  USER_AVATARS: 'to-let-seu/profile-pictures',
} as const;

export const CLOUDINARY_LIMITS = {
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB raw limit (compressed WebP is < 500KB)
  MAX_IMAGES_COUNT: 5,
};

export const generateUploadSignature = (
  folderOrType: 'image' | 'video' | 'avatar' | 'profile-picture' | string = 'image'
) => {
  let folder: string;
  if (folderOrType === 'video') {
    folder = CLOUDINARY_FOLDERS.POST_VIDEOS;
  } else if (
    folderOrType === 'avatar' ||
    folderOrType === 'profile-picture' ||
    folderOrType === 'profile-pictures'
  ) {
    folder = CLOUDINARY_FOLDERS.USER_AVATARS;
  } else if (folderOrType === 'image') {
    folder = CLOUDINARY_FOLDERS.POST_IMAGES;
  } else {
    folder = folderOrType;
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
    },
    ENV.CLOUDINARY_API_SECRET
  );

  return {
    timestamp,
    signature,
    apiKey: ENV.CLOUDINARY_API_KEY,
    cloudName: ENV.CLOUDINARY_CLOUD_NAME,
    folder,
  };
};

export default cloudinary;
