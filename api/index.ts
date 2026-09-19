import { Request, Response } from 'express';
import app from '../src/app';
import { connectDB } from '../src/config/db';

export default async function handler(req: Request, res: Response) {
  await connectDB();
  return app(req, res);
}
