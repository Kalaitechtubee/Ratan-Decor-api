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
const seoRoutes = require('./seo/routes');

// Import initializers (seeders)
const { initializeCategories } = require('./utils/initializeCategories');
const { initializeUserTypes } = require('./utils/userTypeSeeder');

// SEO configuration
const seoConfig = [
  { pageName: "home", title: "Home - Ratan Decor", description: "Welcome to Ratan Decor, your one-stop shop for premium home decor.", keywords: "home, ratan decor, home decor" },
  { pageName: "products", title: "Products - Ratan Decor", description: "Browse our exclusive collection of home decor products.", keywords: "products, shopping, home decor" },
  { pageName: "productdetails", title: "Product Details - Ratan Decor", description: "View detailed information about our home decor products.", keywords: "product, details, home decor" },
  { pageName: "cart", title: "Your Cart - Ratan Decor", description: "Review items in your shopping cart.", keywords: "cart, checkout, shopping" },
  { pageName: "checkout", title: "Checkout - Ratan Decor", description: "Complete your purchase securely.", keywords: "checkout, payment, shopping" },
  { pageName: "order-success", title: "Order Success - Ratan Decor", description: "Thank you for your order! It has been placed successfully.", keywords: "order, success, purchase" },
  { pageName: "about", title: "About Us - Ratan Decor", description: "Learn about Ratan Decor and our mission.", keywords: "about, company, home decor" },
  { pageName: "contact", title: "Contact Us - Ratan Decor", description: "Get in touch with our support team.", keywords: "contact, support, customer service" },
  { pageName: "privacy", title: "Privacy Policy - Ratan Decor", description: "Understand our privacy practices.", keywords: "privacy, policy, data protection" },
  { pageName: "terms", title: "Terms & Conditions - Ratan Decor", description: "Read our terms and conditions.", keywords: "terms, conditions, legal" },
  { pageName: "cookiespolicy", title: "Cookies Policy - Ratan Decor", description: "Learn how we use cookies.", keywords: "cookies, policy, website" },
  { pageName: "returns", title: "Returns & Refunds - Ratan Decor", description: "Understand our return and refund policy.", keywords: "returns, refunds, policy" },
  { pageName: "disclaimer", title: "Disclaimer - Ratan Decor", description: "Read our legal disclaimer.", keywords: "disclaimer, legal, terms" },
  { pageName: "faq", title: "FAQ - Ratan Decor", description: "Find answers to frequently asked questions.", keywords: "faq, help, support" },
  { pageName: "profile", title: "Profile - Ratan Decor", description: "Manage your account settings.", keywords: "profile, account, user" },
];

const app = express();

// --- Database migration utility ---
const runDatabaseMigrations = async () => {
  try {
    console.log('🔧 Running database migrations...');

    // Ensure products.images column exists
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
      const removeUserTypeIdMigration = require('./migrations/20250826000000-remove-userTypeId-from-categories');
      await removeUserTypeIdMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log('✅ userTypeId column removed from categories table successfully');
      
      const updateControllerMigration = require('./migrations/20250826000001-update-category-controller');
      await updateControllerMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    } else {
      console.log('✅ userTypeId column already removed from categories table');
    }

    // Check if seo table exists
    const [seoTable] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'seo'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (seoTable.length === 0) {
      console.log('🔧 Creating seo table...');
      await sequelize.query(`
        CREATE TABLE seo (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          pageName VARCHAR(255) NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          keywords TEXT,
          createdAt DATETIME NOT NULL,
          updatedAt DATETIME NOT NULL
        )
      `);
      console.log('✅ SEO table created successfully');

      // Seed SEO table with all initial data
      console.log('🔧 Seeding SEO table with all pages...');
      for (const seo of seoConfig) {
        await sequelize.query(`
          INSERT INTO seo (pageName, title, description, keywords, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), keywords = VALUES(keywords), updatedAt = NOW()
        `, {
          replacements: [seo.pageName, seo.title, seo.description, seo.keywords]
        });
      }
      console.log('✅ SEO table seeded with all pages successfully');
    } else {
      console.log('✅ SEO table already exists, skipping initial seed but ensuring all pages...');
      // Update existing table to include any missing pages from seoConfig
      for (const seo of seoConfig) {
        const [results] = await sequelize.query(`
          SELECT COUNT(*) as count FROM seo WHERE pageName = ?
        `, { replacements: [seo.pageName] });
        if (results[0].count === 0) {
          await sequelize.query(`
            INSERT INTO seo (pageName, title, description, keywords, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, NOW(), NOW())
          `, {
            replacements: [seo.pageName, seo.title, seo.description, seo.keywords]
          });
          console.log(`✅ Added missing page: ${seo.pageName}`);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    return false;
  }
};

// --- Enhanced CORS and Middleware Configuration ---
app.set('trust proxy', 1);

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Allow localhost and development origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      "Content-Type", "Authorization", "x-request-id",      process.env.FRONTEND_URL
    ].filter(Boolean); // Remove any undefined values
    
    // In development, allow any localhost origin
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development - change this for production
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// Rate limiter with health check exception
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, try again later.' },
  skip: (req) => req.path === '/health' || req.path === '/api/health'
});
app.use(limiter);

// Add request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });
  next();
});

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

// SEO routes - explicitly handle CORS for this endpoint
app.use('/api/seo', (req, res, next) => {
  // Additional CORS headers for SEO endpoints
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
}, seoRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
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

  // Log the error for debugging
  console.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Validation error: ' + err.errors.map(e => e.message).join(', ');
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Duplicate entry error';
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
    
    const startServerOnPort = (port) => {
      return new Promise((resolve, reject) => {
        const server = app.listen(port)
          .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              console.log(`⚠️ Port ${port} is in use, trying ${port + 1}...`);
              resolve(startServerOnPort(port + 1));
            } else {
              reject(err);
            }
          })
          .on('listening', () => {
            console.log(`🚀 Server running on port ${port}`);
            console.log(`📍 Health check: http://localhost:${port}/health`);
            console.log(`📍 API base URL: http://localhost:${port}/api`);
            console.log(`📍 SEO endpoints: http://localhost:${port}/api/seo`);
            resolve(server);
          });
      });
    };
    
    const server = await startServerOnPort(PORT);

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n⚠️ Received ${signal}, shutting down...`);
      server.close(async () => {
        await sequelize.close();
        console.log('✅ Database connection closed');
        process.exit(0);
      });
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