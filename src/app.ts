import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { ENV } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { sendResponse } from './utils/apiResponse';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import mediaRoutes from './routes/media.routes';
import adminRoutes from './routes/admin.routes';

const app: Application = express();

// Middlewares
app.use(
  cors({
    origin: [ENV.CLIENT_URL, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health Check Route
app.get('/api/v1/health', (_req: Request, res: Response) => {
  sendResponse({
    res,
    statusCode: 200,
    success: true,
    message: 'SEU Basa API Online and Healthy',
    data: {
      platform: 'SEU Basa',
      target: 'Southeast University Students (Bachelor Room Rent)',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/admin', adminRoutes);

// Central Error Handler
app.use(errorHandler);

export default app;
