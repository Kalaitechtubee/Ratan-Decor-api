require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const path = require('path');
const rateLimit = require('express-rate-limit');

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
const userRoutes = require('./user/routes');
const shippingAddressRoutes = require('./shipping-address/routes');

// Import initializers
const { initializeCategories } = require('./category/initializeCategories');

const app = express();

// Trust proxy (fix for rate limiter)
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json()); // ✅ Needed for req.body to work

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again later.' }
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/shipping-address', shippingAddressRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-type', userTypeRoutes);
// Add this before app.use('/api/cart', cartRoutes);
// Add this debug middleware right after app.use(express.json());
app.use((req, res, next) => {
  if (req.url.includes('/api/cart') && req.method === 'POST') {
    console.log('🔍 DEBUG - Full request details:');
    console.log('   URL:', req.url);
    console.log('   Method:', req.method);
    console.log('   Headers:', req.headers);
    console.log('   Content-Type:', req.get('Content-Type'));
    console.log('   Content-Length:', req.get('Content-Length'));
    console.log('   Raw Body:', req.body);
    console.log('   Body Type:', typeof req.body);
    console.log('   Body Keys:', Object.keys(req.body));
    console.log('-------------------');
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Initialize product usage types
const initializeProductUsageTypes = async () => {
  try {
    const { ProductUsageType } = require('./models');
    const usageTypes = [
      { name: 'Residential', description: 'For residential use' },
      { name: 'Commercial', description: 'For commercial use' },
      { name: 'Modular Kitchen', description: 'For modular kitchen applications' },
      { name: 'Others', description: 'Other usage types' }
    ];

    for (const usageType of usageTypes) {
      await ProductUsageType.findOrCreate({
        where: { name: usageType.name },
        defaults: usageType
      });
    }

    console.log('✅ ProductUsageType data initialized');
  } catch (error) {
    console.error('❌ ProductUsageType initialization failed:', error);
  }
};

// Database and server startup
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    await sequelize.sync();
    console.log('✅ Database synchronized');

    await initializeCategories();
    await initializeProductUsageTypes();

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
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
