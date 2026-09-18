import app from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';

const startServer = async () => {
  const PORT = Number(ENV.PORT) || 5000;
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 SEU Basa Server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/v1/health`);
    console.log(`🌐 Mode: ${ENV.NODE_ENV}`);
    console.log(`===============================================`);
  });

  // Connect to Database asynchronously
  connectDB();
};

startServer().catch((err) => {
  console.error('Fatal Server Boot Error:', err);
});
