import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { ENV } from '../config/env';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors = [];

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors || [];
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Database Validation Failed';
    errors = Object.values(err.errors || {}).map((e: any) => e.message);
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID format: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value entered';
  } else if (err instanceof Error) {
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(ENV.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
