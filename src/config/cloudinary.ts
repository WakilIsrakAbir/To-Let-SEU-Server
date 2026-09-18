import { v2 as cloudinary } from 'cloudinary';
import { ENV } from './env';

cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
  secure: true,
});

export const CLOUDINARY_LIMITS = {
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_VIDEO_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  MAX_IMAGES_COUNT: 5,
  MAX_VIDEO_COUNT: 1,
};

export const generateUploadSignature = (folder: string = 'seu-basa/listings') => {
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
