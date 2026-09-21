import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { ENV } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { sendResponse } from './utils/apiResponse';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import mediaRoutes from './routes/media.routes';
import adminRoutes from './routes/admin.routes';

const app: Application = express();

// 1. Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 2. Strict CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedClient = ENV.CLIENT_URL ? ENV.CLIENT_URL.replace(/\/$/, '') : '';
      const allowedOrigins = [
        normalizedClient,
        'http://localhost:3000',
        'http://localhost:3001',
      ].filter(Boolean);

      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        (normalizedClient && origin.startsWith(normalizedClient))
      ) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy: Origin not allowed.'));
    },
    credentials: true,
  })
);

// 3. Rate Limiting Protection (Anti Brute-Force & Anti DoS)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // max 300 requests per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 login/register attempts per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Enable Gzip / Brotli response compression for all responses
app.use(compression());

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Root Welcome & Status Route
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: '🚀 To Let SEU API Server is running successfully on Vercel!',
    platform: 'To Let SEU',
    version: '1.0.0',
    endpoints: {
      health: '/api/v1/health',
      posts: '/api/v1/posts',
      auth: '/api/v1/auth',
    },
  });
});

// Health Check Route
app.get('/api/v1/health', (_req: Request, res: Response) => {
  const isConnected = mongoose.connection.readyState === 1;
  sendResponse({
    res,
    statusCode: 200,
    success: true,
    message: isConnected ? 'To Let SEU API Online and Healthy' : 'To Let SEU API Online (Database Disconnected)',
    data: {
      platform: 'To Let SEU',
      target: 'Southeast University Students (Bachelor Room Rent)',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: {
        status: isConnected ? 'connected' : 'disconnected',
        readyState: mongoose.connection.readyState,
        mongoUriConfigured: Boolean(process.env.MONGO_URI),
      },
    },
  });
});

// Mount Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/admin', adminRoutes);

// Central Error Handler
app.use(errorHandler);

export default app;
