require('dotenv').config();
const path = require('path');
const sequelize = require('./config/database');
const app = require('./app');
const http = require('http');


const startServer = async () => {
  try {
    await sequelize.authenticate();

    // Seed user types before syncing to avoid foreign key constraint errors


    // Temporarily disable foreign key checks for sync (if needed in your schema)
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    // sequelize.sync()
    await sequelize.sync({ alter: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    const PORT = process.env.PORT || 3000;
    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API URL: http://localhost:${PORT}/api`);
      console.log(`Documentation: http://localhost:${PORT}/api-docs`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please free it or specify another PORT.`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received: shutting down gracefully...`);
      server.close(async () => {
        try {
          await sequelize.close();
          console.log('Database connection closed.');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force exit after timeout
      setTimeout(() => {
        console.error('Forced shutdown due to timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

startServer();

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = app;