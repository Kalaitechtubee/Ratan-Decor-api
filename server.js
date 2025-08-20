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
const userTypeRoutes = require('./userType/routes');
const userRoutes = require('./user/routes');
const shippingAddressRoutes = require('./shipping-address/routes');
const userRoleRoutes = require('./userRole/routes');
const enquiryRoutes = require('./enquiry/routes');

// Import initializers (seeders)
const { initializeCategories } = require('./utils/initializeCategories');
const { initializeUserTypes } = require('./utils/userTypeSeeder');

const app = express();

// --- Database migration utility ---
const runDatabaseMigrations = async () => {
  try {
    console.log('🔧 Running database migrations...');

    // Ensure products.images column exists
    // Check for images column
    const [imagesResults] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' 
        AND COLUMN_NAME = 'images'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (imagesResults.length === 0) {
      console.log('🔧 Adding missing images column to products table...');
      await sequelize.query(`
        ALTER TABLE products 
        ADD COLUMN images JSON DEFAULT (JSON_ARRAY())
      `);
      console.log('✅ Images column added successfully');
    } else {
      console.log('✅ Images column already exists');
    }
    
    // Check for warranty column
    const [warrantyResults] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' 
        AND COLUMN_NAME = 'warranty'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (warrantyResults.length === 0) {
      console.log('🔧 Adding missing warranty column to products table...');
      await sequelize.query(`
        ALTER TABLE products 
        ADD COLUMN warranty VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Warranty column added successfully');
    } else {
      console.log('✅ Warranty column already exists');
    }
    
    // Check if enquiries table exists
    const [enquiriesTable] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'enquiries'
        AND TABLE_SCHEMA = DATABASE()
    `);
    
    if (enquiriesTable.length === 0) {
      console.log('🔧 Creating enquiries table...');
      // Run the migration manually
      const enquiriesMigration = require('./migrations/20250820000000-create-enquiries-table');
      await enquiriesMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log('✅ Enquiries table created successfully');
    } else {
      console.log('✅ Enquiries table already exists');
    }

    // Check for brandName column in categories table
    const [brandNameResults] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'categories' 
        AND COLUMN_NAME = 'brandName'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (brandNameResults.length === 0) {
      console.log('🔧 Adding brandName column to categories table...');
      // Run the migration manually
      const brandNameMigration = require('./migrations/20250825000000-add-brandName-to-categories');
      await brandNameMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log('✅ brandName column added to categories table successfully');
    } else {
      console.log('✅ brandName column already exists in categories table');
    }
    
    // Check for userTypeId column in categories table
    const [userTypeIdResults] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'categories' 
        AND COLUMN_NAME = 'userTypeId'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (userTypeIdResults.length > 0) {
      console.log('🔧 Removing userTypeId column from categories table...');
      // Run the migration manually
      const removeUserTypeIdMigration = require('./migrations/20250826000000-remove-userTypeId-from-categories');
      await removeUserTypeIdMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log('✅ userTypeId column removed from categories table successfully');
      
      // Run the controller update reminder migration
      const updateControllerMigration = require('./migrations/20250826000001-update-category-controller');
      await updateControllerMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    } else {
      console.log('✅ userTypeId column already removed from categories table');
    }

    return true;
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    return false;
  }
};

// --- Middleware ---
app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, try again later.' },
  skip: (req) => req.path === '/health'
});
app.use(limiter);

// --- API Routes ---
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
app.use('/api/user-types', userTypeRoutes);
app.use('/api/roles', userRoleRoutes);
app.use('/api/enquiries', enquiryRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API docs
app.get('/api', (req, res) => {
  res.json({ message: 'API Server is running', version: '1.0.0' });
});

// Root route handler
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Ratan Decor API Server is running', 
    version: '1.0.0',
    documentation: '/api'
  });
});

// 404 handler (API only)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.path
  });
});

// General 404 handler for non-API routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path
  });
});

// --- Error Handler ---
app.use((err, req, res, next) => {
  let statusCode = err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Validation error: ' + err.errors.map(e => e.message).join(', ');
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Duplicate entry error';
  }
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  res.status(statusCode).json({ success: false, message });
});

// --- Start Server ---
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Sync models
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Database synced');

    // Run DB migrations & seeders
    await runDatabaseMigrations();
    await initializeUserTypes();
    await initializeCategories();

    let PORT = process.env.PORT || 3000;
    
    // Function to start server with port fallback
    const startServer = (port) => {
      return new Promise((resolve, reject) => {
        const server = app.listen(port)
          .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              console.log(`⚠️ Port ${port} is in use, trying ${port}...`);
              resolve(startServer(port + 1));
            } else {
              reject(err);
            }
          })
          .on('listening', () => {
            console.log(`🚀 Server running on port ${port}`);
            resolve(server);
          });
      });
    };
    
    // Start server with initial port
    const server = await startServer(PORT);

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n⚠️ Received ${signal}, shutting down...`);
      server.close(async () => {
        await sequelize.close();
        process.exit(0);
      });
      // Force exit if shutdown takes >30s
      setTimeout(() => process.exit(1), 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Global error handling for crashes
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
  process.exit(1);
});

// Boot server
startServer();

module.exports = app;
