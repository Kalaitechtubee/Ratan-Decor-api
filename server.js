require('dotenv').config();
const http = require('http');
const sequelize = require('./config/database');
const app = require('./app');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    console.log('🔄 Starting server...');
    console.log('🌱 Environment:', process.env.NODE_ENV);

    // 1️⃣ DB connection
    console.log('📊 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // 2️⃣ SAFE sync logic
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ DEV mode: syncing with alter');
      await sequelize.sync({ alter: true });
    } else {
      console.log('🔒 PROD mode: safe sync (NO alter)');
      await sequelize.sync(); // ✅ THIS IS THE FIX
    }

    console.log('✅ Models synced');

    // 3️⃣ Start server
    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 API URL: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
      console.log(`📘 Docs: http://localhost:${PORT}/api-docs`);
    });

    // 4️⃣ Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n⚠️ ${signal} received. Shutting down...`);
      server.close(async () => {
        await sequelize.close();
        console.log('🔒 Database connection closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

startServer();
