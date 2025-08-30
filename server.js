require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initializeCategories } = require('./utils/initializeCategories');
const { initializeUserTypes } = require('./utils/userTypeSeeder');

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
const videoCallEnquiryRoutes = require('./VideoCallEnquiry/routes');
// SEO configuration
const seoConfig = [
  { pageName: 'home', title: 'Home - Ratan Decor', description: 'Welcome to Ratan Decor, your one-stop shop for premium home decor.', keywords: 'home, ratan decor, home decor' },
  { pageName: 'products', title: 'Products - Ratan Decor', description: 'Browse our exclusive collection of home decor products.', keywords: 'products, shopping, home decor' },
  { pageName: 'productdetails', title: 'Product Details - Ratan Decor', description: 'View detailed information about our home decor products.', keywords: 'product, details, home decor' },
  { pageName: 'cart', title: 'Your Cart - Ratan Decor', description: 'Review items in your shopping cart.', keywords: 'cart, checkout, shopping' },
  { pageName: 'checkout', title: 'Checkout - Ratan Decor', description: 'Complete your purchase securely.', keywords: 'checkout, payment, shopping' },
  { pageName: 'order-success', title: 'Order Success - Ratan Decor', description: 'Thank you for your order! It has been placed successfully.', keywords: 'order, success, purchase' },
  { pageName: 'about', title: 'About Us - Ratan Decor', description: 'Learn about Ratan Decor and our mission.', keywords: 'about, company, home decor' },
  { pageName: 'contact', title: 'Contact Us - Ratan Decor', description: 'Get in touch with our support team.', keywords: 'contact, support, customer service' },
  { pageName: 'privacy', title: 'Privacy Policy - Ratan Decor', description: 'Understand our privacy practices.', keywords: 'privacy, policy, data protection' },
  { pageName: 'terms', title: 'Terms & Conditions - Ratan Decor', description: 'Read our terms and conditions.', keywords: 'terms, conditions, legal' },
  { pageName: 'cookiespolicy', title: 'Cookies Policy - Ratan Decor', description: 'Learn how we use cookies.', keywords: 'cookies, policy, website' },
  { pageName: 'returns', title: 'Returns & Refunds - Ratan Decor', description: 'Understand our return and refund policy.', keywords: 'returns, refunds, policy' },
  { pageName: 'disclaimer', title: 'Disclaimer - Ratan Decor', description: 'Read our legal disclaimer.', keywords: 'disclaimer, legal, terms' },
  { pageName: 'faq', title: 'FAQ - Ratan Decor', description: 'Find answers to frequently asked questions.', keywords: 'faq, help, support' },
  { pageName: 'profile', title: 'Profile - Ratan Decor', description: 'Manage your account settings.', keywords: 'profile, account, user' },
];

const app = express();

// Database migrations
const runDatabaseMigrations = async () => {
  try {
    // Add images column to products table if missing
    const [imagesResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'images' AND TABLE_SCHEMA = DATABASE()
    `);
    if (imagesResults.length === 0) {
      await sequelize.query(`ALTER TABLE products ADD COLUMN images JSON DEFAULT (JSON_ARRAY())`);
    }

    // Add warranty column to products table if missing
    const [warrantyResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'warranty' AND TABLE_SCHEMA = DATABASE()
    `);
    if (warrantyResults.length === 0) {
      await sequelize.query(`ALTER TABLE products ADD COLUMN warranty VARCHAR(255) DEFAULT NULL`);
    }

    // Create enquiries table if missing
    const [enquiriesTable] = await sequelize.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'enquiries' AND TABLE_SCHEMA = DATABASE()
    `);
    if (enquiriesTable.length === 0) {
      const enquiriesMigration = require('./migrations/20250820000000-create-enquiries-table');
      await enquiriesMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    }

    // Add brandName column to categories table if missing
    const [brandNameResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'categories' AND COLUMN_NAME = 'brandName' AND TABLE_SCHEMA = DATABASE()
    `);
    if (brandNameResults.length === 0) {
      const brandNameMigration = require('./migrations/20250825000000-add-brandName-to-categories');
      await brandNameMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    }

    // Remove userTypeId column from categories table if present
    const [userTypeIdResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'categories' AND COLUMN_NAME = 'userTypeId' AND TABLE_SCHEMA = DATABASE()
    `);
    if (userTypeIdResults.length > 0) {
      const removeUserTypeIdMigration = require('./migrations/20250826000000-remove-userTypeId-from-categories');
      await removeUserTypeIdMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      const updateControllerMigration = require('./migrations/20250826000001-update-category-controller');
      await updateControllerMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    }

    // Create or update seo table
    const [seoTable] = await sequelize.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'seo' AND TABLE_SCHEMA = DATABASE()
    `);
    if (seoTable.length === 0) {
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
      for (const seo of seoConfig) {
        await sequelize.query(`
          INSERT INTO seo (pageName, title, description, keywords, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, NOW(), NOW())
        `, { replacements: [seo.pageName, seo.title, seo.description, seo.keywords] });
      }
    } else {
      for (const seo of seoConfig) {
        const [results] = await sequelize.query(`SELECT COUNT(*) as count FROM seo WHERE pageName = ?`, { replacements: [seo.pageName] });
        if (results[0].count === 0) {
          await sequelize.query(`
            INSERT INTO seo (pageName, title, description, keywords, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, NOW(), NOW())
          `, { replacements: [seo.pageName, seo.title, seo.description, seo.keywords] });
        }
      }
    }
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
};

// Middleware
app.set('trust proxy', 1);

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV === 'development' && (origin.includes('localhost') || origin.includes('127.0.0.1')))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, skip: (req) => req.path === '/health' || req.path === '/api/health' }));

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
app.use('/api/user-types', userTypeRoutes);
app.use('/api/roles', userRoleRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/seo', cors(corsOptions), seoRoutes);
app.use('/api/video-call-enquiries', videoCallEnquiryRoutes); // ✅ add this
// Health check
app.get('/health', (req, res) => res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() }));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() }));

// API root
app.get('/api', (req, res) => res.json({ message: 'API Server is running', version: '1.0.0' }));
app.get('/', (req, res) => res.json({ success: true, message: 'Ratan Decor API Server is running', version: '1.0.0', documentation: '/api' }));

// 404 handler
app.use('/api/*', (req, res) => res.status(404).json({ success: false, message: 'API endpoint not found', path: req.path }));
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Endpoint not found', path: req.path }));

// Error handler
app.use((err, req, res, next) => {
  let statusCode = err.status || 500;
  let message = err.message || 'Internal Server Error';
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Validation error: ' + err.errors.map(e => e.message).join(', ');
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Duplicate entry error';
  }
  console.error('Error:', { message: err.message, stack: err.stack, path: req.path, method: req.method });
  res.status(statusCode).json({ success: false, message });
});

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    await runDatabaseMigrations();
    await initializeUserTypes();
    await initializeCategories();

const PORT = process.env.PORT || 3000;

const server = await new Promise((resolve, reject) => {
  const s = app.listen(PORT)
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(app.listen(PORT + 1));
      } else {
        reject(err);
      }
    })
    .on('listening', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      resolve(s);
    });
});


    process.on('SIGTERM', async () => {
      server.close(async () => {
        await sequelize.close();
        process.exit(0);
      });
    });
    process.on('SIGINT', async () => {
      server.close(async () => {
        await sequelize.close();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

startServer();

module.exports = app;