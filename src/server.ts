import app from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';
import { cleanupExpiredPosts } from './services/autoCleanup.service';

const startServer = async () => {
  const PORT = Number(ENV.PORT) || 5000;
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 To Let SEU Server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/v1/health`);
    console.log(`🌐 Mode: ${ENV.NODE_ENV}`);
    console.log(`===============================================`);
  });

  // Connect to Database asynchronously
  await connectDB();

  // Initial 60-day auto-purge check on server startup (non-blocking)
  cleanupExpiredPosts(60).catch((err) => {
    console.warn('[AutoCleanup] Startup cleanup check notice:', err?.message);
  });

  // Schedule daily auto-purge (every 24 hours) for long-running server instances
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    console.log('[AutoCleanup] Running scheduled daily 60-day post purge check...');
    cleanupExpiredPosts(60).catch((err) => {
      console.warn('[AutoCleanup] Scheduled cleanup error:', err?.message);
    });
  }, TWENTY_FOUR_HOURS);
};

startServer().catch((err) => {
  console.error('Fatal Server Boot Error:', err);
});
