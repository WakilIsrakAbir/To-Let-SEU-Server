import { Request, Response, NextFunction } from 'express';
import { generateUploadSignature, CLOUDINARY_LIMITS } from '../config/cloudinary';
import cloudinary from '../config/cloudinary';
import { sendResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export const getUploadSignature = (
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const folder = (req.query.folder as string) || 'seu-basa/listings';
  const signData = generateUploadSignature(folder);

  return sendResponse({
    res,
    statusCode: 200,
    message: 'Upload signature generated successfully',
    data: {
      ...signData,
      limits: CLOUDINARY_LIMITS,
    },
  });
};

export const deleteCloudinaryMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicId, resourceType } = req.body;
    if (!publicId) {
      return next(new ApiError(400, 'publicId is required to delete media.'));
    }

    const type = resourceType === 'video' ? 'video' : 'image';
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: type,
    });

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Media deleted from Cloudinary',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
