import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUserDocument } from '../models/User.model';
import { ENV } from '../config/env';
import { ApiError } from '../utils/apiError';
import { sendResponse } from '../utils/apiResponse';
import { AuthRequest } from '../middlewares/auth.middleware';

const generateToken = (userId: string): string => {
  return jwt.sign({ id: userId }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as any,
  });
};

const sendTokenResponse = (
  user: IUserDocument,
  statusCode: number,
  res: Response,
  message: string
) => {
  const token = generateToken(user._id.toString());

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };

  res.cookie('token', token, cookieOptions);

  const sanitizedUser = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    department: user.department,
    studentId: user.studentId,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isVerifiedStudent: user.isVerifiedStudent,
    status: user.status,
    createdAt: user.createdAt,
  };

  return sendResponse({
    res,
    statusCode,
    message,
    data: {
      user: sanitizedUser,
      token,
    },
  });
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, password, phone, department, studentId } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(
        new ApiError(409, 'An account with this email address already exists.')
      );
    }

    // First registered user gets Admin role, others default to 'user'
    const totalUsers = await User.countDocuments();
    const role = totalUsers === 0 ? 'admin' : 'user';

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      department,
      studentId,
      role,
      isVerifiedStudent: !!studentId, // Automatically mark verified if student ID given
    });

    return sendTokenResponse(user, 201, res, 'Account registered successfully.');
  } catch (error) {
    return next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );

    if (!user) {
      return next(new ApiError(401, 'Invalid email or password.'));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new ApiError(401, 'Invalid email or password.'));
    }

    if (user.status === 'suspended') {
      return next(
        new ApiError(403, 'Your account is suspended. Contact administrator.')
      );
    }

    return sendTokenResponse(user, 200, res, 'Logged in successfully.');
  } catch (error) {
    return next(error);
  }
};

export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, 'User session not found.'));
    }

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Current profile retrieved.',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required.'));
    }

    const { name, phone, department, studentId, avatarUrl } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(department && { department }),
        ...(studentId && { studentId, isVerifiedStudent: true }),
        ...(avatarUrl && { avatarUrl }),
      },
      { new: true, runValidators: true }
    );

    return sendResponse({
      res,
      statusCode: 200,
      message: 'Profile updated successfully.',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const logout = (
  _req: Request,
  res: Response
) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  return sendResponse({
    res,
    statusCode: 200,
    message: 'Logged out successfully.',
  });
};
