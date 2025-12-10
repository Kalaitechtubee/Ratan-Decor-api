// server.js
require('dotenv').config();
const path = require('path');
const sequelize = require('./config/database');
const app = require('./app');
const uploadsPath = path.join(__dirname, 'uploads');

const startServer = async () => {
  try {
    console.log('🔄 Starting Ratan Decor API Server...');
   
    console.log('📊 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    console.log('🔄 Syncing database...');
    await sequelize.sync({ alter: false });
    console.log('✅ Database synced successfully');
    
    const PORT = process.env.PORT || 3000;
    const server = await new Promise((resolve, reject) => {
      const s = app.listen(PORT)
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${PORT} in use, trying ${PORT + 1}...`);
            resolve(app.listen(PORT + 1));
          } else {
            reject(err);
          }
        })
        .on('listening', () => {
          const actualPort = s.address().port;
          console.log('');
          console.log('🚀 ===============================================');
          console.log(`🌟 Server running on port ${actualPort}`);
          console.log('🚀 ===============================================');
          console.log(`🌐 API URL: http://localhost:${actualPort}/api`);
          console.log(`📚 API Documentation: http://localhost:${actualPort}/api-docs`);
          console.log(`🖼️ Static uploads: http://localhost:${actualPort}/uploads/`);
          console.log(`🖼️ Image API: http://localhost:${actualPort}/api/images/{type}/{filename}`);
          console.log(`🔍 Check file: http://localhost:${actualPort}/api/check-file/{type}/{filename}`);
          console.log('');
          console.log('🔐 SuperAdmin Credentials:');
          console.log(` 📧 Email: ${process.env.SUPERADMIN_EMAIL || 'superadmin@ratandecor.com'}`);
          console.log(` 🔑 Password: ${process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123'}`);
          console.log('');
          console.log('✅ Uploads directory: ' + uploadsPath);
          console.log('✅ Static file serving configured');
          console.log('✅ CORS enabled for all origins');
          console.log('🚀 ===============================================');
          console.log('');
          resolve(s);
        });
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\n📴 ${signal} received, shutting down gracefully...`);
      server.close(async () => {
        try {
          await sequelize.close();
          console.log('✅ Database connection closed');
          console.log('✅ Server stopped gracefully');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
     
      setTimeout(() => {
        console.error('❌ Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };
   
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
   
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;