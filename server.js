
require('dotenv').config();
const http = require('http');
const sequelize = require('./config/database');
const app = require('./app');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    console.log('🔄 Starting server...');

    // 1️⃣ Verify DB connection
    console.log('📊 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // 2️⃣ Sync models (SAFE MODE)
    // ❌ NO alter
    // ❌ NO force
    console.log('🔄 Syncing models...');
    await sequelize.sync();
    console.log('✅ Models synced');

    // 3️⃣ Start HTTP server
    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 API URL: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
      console.log(`📘 Docs: http://localhost:${PORT}/api-docs`);
      console.log(`🌱 Environment: ${process.env.NODE_ENV}`);
    });

    // 4️⃣ Server error handling
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', err);
      }
      process.exit(1);
    });

    // 5️⃣ Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n⚠️ ${signal} received. Shutting down...`);
      server.close(async () => {
        try {
          await sequelize.close();
          console.log('🔒 Database connection closed');
          process.exit(0);
        } catch (err) {
          console.error('❌ Shutdown error:', err);
          process.exit(1);
        }
      });

      // Force exit after 10s
      setTimeout(() => {
        console.error('❌ Force shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

startServer();

// 6️⃣ Global safety nets
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = app;
