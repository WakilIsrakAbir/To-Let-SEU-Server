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
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail.endsWith('@gmail.com') && !normalizedEmail.endsWith('@seu.edu.bd')) {
      return next(
        new ApiError(400, 'Only valid @seu.edu.bd and @gmail.com accounts are permitted to register.')
      );
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return next(
        new ApiError(409, 'An account with this email address already exists.')
      );
    }

    // Role: Check if listed in ADMIN_EMAILS whitelist, else fallback to first user
    const totalUsers = await User.countDocuments();
    const isAdmin =
      ENV.ADMIN_EMAILS.includes(normalizedEmail) || totalUsers === 0;
    const role = isAdmin ? 'admin' : 'user';

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      phone,
      department,
      studentId,
      role,
      authProvider: 'local',
      isVerifiedStudent: !!studentId,
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
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select(
      '+password'
    );

    if (!user) {
      return next(new ApiError(401, 'Invalid email or password.'));
    }

    // If user has no password and used Google Auth
    if (!user.password && user.authProvider === 'google') {
      return next(
        new ApiError(
          400,
          'This account is registered via Google. Please use "Continue with Google" to sign in.'
        )
      );
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

export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, name, avatarUrl, googleId, department, studentId, phone } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!normalizedEmail.endsWith('@gmail.com') && !normalizedEmail.endsWith('@seu.edu.bd')) {
      return next(
        new ApiError(400, 'Only valid @seu.edu.bd and @gmail.com accounts are permitted.')
      );
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      if (user.status === 'suspended') {
        return next(
          new ApiError(403, 'Your account is suspended. Contact administrator.')
        );
      }

      // Check if user should have admin role based on whitelist
      if (user.role !== 'admin' && ENV.ADMIN_EMAILS.includes(normalizedEmail)) {
        user.role = 'admin';
      }

      // Update avatar or Google ID if newly available
      if (avatarUrl && (!user.avatarUrl || user.avatarUrl.includes('cld-sample'))) {
        user.avatarUrl = avatarUrl;
      }
      if (googleId && !user.googleId) {
        user.googleId = googleId;
      }
      await user.save();

      return sendTokenResponse(user, 200, res, 'Logged in with Google successfully.');
    }

    // Create new Google-authenticated student account
    const totalUsers = await User.countDocuments();
    const isAdmin =
      ENV.ADMIN_EMAILS.includes(normalizedEmail) || totalUsers === 0;

    user = await User.create({
      name: name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      avatarUrl: avatarUrl || undefined,
      googleId: googleId || '',
      authProvider: 'google',
      department: department || 'CSE',
      phone: phone || '',
      studentId: studentId || '',
      isVerifiedStudent: !!studentId,
      role: isAdmin ? 'admin' : 'user',
    });

    return sendTokenResponse(
      user,
      201,
      res,
      'Welcome to To Let SEU! Account created with Google.'
    );
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
