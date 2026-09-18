import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ApiError } from '../utils/apiError';
import { UserRole } from '../models/User.model';

export const requireRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access forbidden. Requires one of roles: [${roles.join(', ')}]`
        )
      );
    }

    next();
  };
};

export const requireAdmin = requireRoles('admin');
export const requireModeratorOrAdmin = requireRoles('moderator', 'admin');
