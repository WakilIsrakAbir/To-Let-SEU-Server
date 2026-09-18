import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { ApiError } from '../utils/apiError';
import { User, IUserDocument } from '../models/User.model';

export interface AuthRequest extends Request {
  user?: IUserDocument;
}

export const verifyToken = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Check Bearer authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(new ApiError(401, 'Access denied. Please log in first.'));
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ApiError(401, 'User account no longer exists.'));
    }

    if (user.status === 'suspended') {
      return next(new ApiError(403, 'Your account has been suspended by an administrator.'));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError(401, 'Invalid or expired session token.'));
  }
};
