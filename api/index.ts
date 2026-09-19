import { Request, Response } from 'express';
import app from '../src/app';
import { connectDB } from '../src/config/db';

export default async function handler(req: Request, res: Response) {
  try {
    await connectDB();
  } catch (err: any) {
    console.error('[Vercel Handler] Database connection failed:', err?.message);
    // Allow root and health check routes to run so diagnostics are accessible
    if (req.url === '/' || req.url?.startsWith('/api/v1/health')) {
      return app(req, res);
    }
    return res.status(503).json({
      success: false,
      message: 'Database connection failed. Please ensure MONGO_URI is configured in Vercel Environment Variables and MongoDB Atlas Network Access has 0.0.0.0/0 whitelisted.',
      error: err?.message,
    });
  }
  return app(req, res);
}
