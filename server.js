require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const { Category } = require('./models');

// Import routes
const authRoutes = require('./auth/routes');
const productRoutes = require('./product/routes');
const adminRoutes = require('./admin/routes');
const addressRoutes = require('./address/routes');
const cartRoutes = require('./cart/routes');
const orderRoutes = require('./order/routes');
const profileRoutes = require('./profile/routes');
const categoryRoutes = require('./category/routes');
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Initialize categories
const initializeCategories = async () => {
  try {
    const categories = [
      { name: 'Plywood', subCategories: ['Commercial', 'Waterproof'] },
      { name: 'Mica', subCategories: ['1 mm Regular', '1 mm Texture', '1 mm Acrylic'] },
      { name: 'Veneer', subCategories: ['Natural', 'Recon', 'Smoked'] },
      { name: 'Flush Door & Frames', subCategories: ['Solid wood', 'Plain', 'PVC'] },
      { name: 'PVC', subCategories: ['Charcoal', 'Solid wood', 'Flexi'] },
      { name: 'Decorative sheets', subCategories: ['Albaster sheets', 'Corian Sheets'] }
    ];

    for (const category of categories) {
      const [parent] = await Category.findOrCreate({ 
        where: { name: category.name } 
      });
      
      for (const subCategory of category.subCategories) {
        await Category.findOrCreate({
          where: { name: subCategory },
          defaults: { parentId: parent.id }
        });
      }
    }
    console.log('✅ Categories initialized');
  } catch (error) {
    console.error('❌ Category initialization failed:', error);
    throw error;
  }
};

// Database and server startup
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync models
    await sequelize.sync({ alter: false });
    console.log('✅ Database synchronized');

    // Initialize default data
    await initializeCategories();

    // Start server
    const PORT = process.env.PORT || 3001;
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