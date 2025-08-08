require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

// Import routes
const authRoutes = require('./auth/routes');
const productRoutes = require('./product/routes');
const adminRoutes = require('./admin/routes');
const addressRoutes = require('./address/routes');
const cartRoutes = require('./cart/routes');
const orderRoutes = require('./order/routes');
const profileRoutes = require('./profile/routes');
const categoryRoutes = require('./category/routes');
const userTypeRoutes = require('./routes/userType');
const userRoutes = require('./user/routes'); // adjust path if needed

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-type', userTypeRoutes);
// server.js
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Initialize categories
const initializeCategories = async () => {
  try {
    console.log('✅ Categories initialization skipped for now');
    // Temporarily skip category initialization to avoid timestamp issues
  } catch (error) {
    console.error('❌ Category initialization failed:', error);
    // Don't throw error, just log it
  }
};

// Database and server startup
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Simple sync without force or alter
    await sequelize.sync();
    console.log('✅ Database synchronized');

    // Initialize default data
    await initializeCategories();

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Error handling
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  // Don't exit for uncaught exceptions to keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the application
startServer();