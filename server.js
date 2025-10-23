// Ratan Decor API Server - Updated for SuperAdmin fix and Rate Limiting Improvements
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { initializeCategories } = require('./utils/initializeCategories');
const { initializeUserTypes } = require('./utils/userTypeSeeder');
const { initializeSuperAdmin } = require('./utils/initializeSuperAdmin');

// Swagger imports
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

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
const contactRoutes = require('./contact/router');

// Security middleware
const { 
  sanitizeInput, 
  auditLogger, 
  trackSuspiciousActivity,
  rateLimits // Import specific rate limiters
} = require('./middleware/security');

const app = express();

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
  { pageName: 'OrderDetails', title: 'OrderDetails - Ratan Decor', description: 'Manage your account settings.', keywords: 'OrderDetails, account, user' },
    { pageName: "VideoCall", title: "Video Call - Ratan Decor", description: "Connect with our experts via video call for personalized assistance.", keywords: "video call, support, consultation, home decor" },

];

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
      console.log('✅ Added images column to products table');
    }

    // Add warranty column to products table if missing
    const [warrantyResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'warranty' AND TABLE_SCHEMA = DATABASE()
    `);
    if (warrantyResults.length === 0) {
      await sequelize.query(`ALTER TABLE products ADD COLUMN warranty VARCHAR(255) DEFAULT NULL`);
      console.log('✅ Added warranty column to products table');
    }

    // Create enquiries table if missing
    const [enquiriesTable] = await sequelize.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'enquiries' AND TABLE_SCHEMA = DATABASE()
    `);
    if (enquiriesTable.length === 0) {
      const enquiriesMigration = require('./migrations/20250820000000-create-enquiries-table');
      await enquiriesMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log('✅ Created enquiries table');
    }

    // Add brandName column to categories table if missing
    const [brandNameResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'categories' AND COLUMN_NAME = 'brandName' AND TABLE_SCHEMA = DATABASE()
    `);
    if (brandNameResults.length === 0) {
      const brandNameMigration = require('./migrations/20250825000000-add-brandName-to-categories');
      await brandNameMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log('✅ Added brandName column to categories table');
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
      console.log('✅ Removed userTypeId column from categories table');
    }

    // Ensure SuperAdmin is in the role enum
    try {
      const [enumResults] = await sequelize.query(`
        SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role' AND TABLE_SCHEMA = DATABASE()
      `);
      const columnType = enumResults[0].COLUMN_TYPE;
      if (!columnType.includes("'SuperAdmin'")) {
        await sequelize.query(`
          ALTER TABLE users MODIFY COLUMN role ENUM('customer','General','Architect','Dealer','Admin','Manager','Sales','Support','SuperAdmin') NOT NULL DEFAULT 'General'
        `);
        console.log('✅ Added SuperAdmin to users.role enum');
      } else {
        console.log('✅ SuperAdmin already in users.role enum');
      }
    } catch (error) {
      console.error('❌ Error updating role enum:', error);
      // Try the migration as fallback
      const superAdminRoleMigration = require('./migrations/20250904110000-add-superadmin-role-enum');
      await superAdminRoleMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log('✅ Added SuperAdmin role to users table enum via migration');
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
      console.log('✅ Created seo table');

      for (const seo of seoConfig) {
        await sequelize.query(`
          INSERT INTO seo (pageName, title, description, keywords, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, NOW(), NOW())
        `, { replacements: [seo.pageName, seo.title, seo.description, seo.keywords] });
      }
      console.log('✅ Populated seo table with default data');
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
    console.error('❌ Database migration failed:', error);
    throw error;
  }
};

// Security configuration
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Enhanced CORS configuration
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
    
    if (!origin || allowedOrigins.includes(origin) || 
        (process.env.NODE_ENV === 'development' && 
         (origin.includes('localhost') || origin.includes('127.0.0.1')))) {
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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(trackSuspiciousActivity);
app.use(sanitizeInput);
app.use(auditLogger);

// Enhanced static file serving for uploads with proper image headers
app.use('/uploads', express.static(path.join(__dirname, 'Uploads'), {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Set proper content type for images
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    
    if (contentTypeMap[ext]) {
      res.setHeader('Content-Type', contentTypeMap[ext]);
    }
    
    // Add CORS headers for images
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Add cache control for better performance
    res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
  }
}));

// Apply specific rate limiters to routes (improved and granular)
// Skip rate limiting for health checks, docs, and uploads across all
const skipRateLimit = (req) => {
  return req.path === '/health' || 
         req.path === '/api/health' || 
         req.path.startsWith('/api-docs') ||
         req.path.startsWith('/uploads') ||
         req.path.startsWith('/api/images');
};

// Auth routes - strict but reasonable limits
app.use('/api/auth', rateLimits.auth, authRoutes);

// Registration-specific (if separate, but assuming under auth)
app.use('/api/auth/register', rateLimits.register);

// OTP/Reset under auth, but can be more specific if needed
app.use('/api/auth/otp', rateLimits.otp);

// Admin routes - moderate limits
app.use('/api/admin', rateLimits.admin, adminRoutes);

// General API routes - balanced limits
app.use('/api', rateLimits.general);

// Swagger UI setup
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info hgroup.main h2 { color: #3b4151; }
    .swagger-ui .scheme-container { background: #fff; padding: 0; }
  `,
  customSiteTitle: 'Ratan Decor API Documentation',
  customfavIcon: '/uploads/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    tryItOutEnabled: true,
  }
};

// Swagger routes
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Optional: Raw JSON endpoint for API spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Enhanced image serving endpoint with proper error handling and validation
app.get('/api/images/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params;
    
    // Validate image type
    const allowedTypes = ['products', 'categories', 'users', 'defaults'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image type',
        allowedTypes
      });
    }
    
    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    // Construct file path
    const imagePath = path.join(__dirname, 'Uploads', type, filename);
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(imagePath)) {
      // Try to serve default no-image placeholder
      const defaultImagePath = path.join(__dirname, 'Uploads', 'defaults', 'no-image.png');
      if (fs.existsSync(defaultImagePath)) {
        return res.sendFile(defaultImagePath);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Image not found',
        filename,
        type
      });
    }
    
    // Set proper headers and serve image
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    
    if (contentTypeMap[ext]) {
      res.setHeader('Content-Type', contentTypeMap[ext]);
    }
    
    res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(imagePath);
    
  } catch (error) {
    console.error('IMAGE SERVING ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving image'
    });
  }
});

// API Routes with proper ordering and rate limiting applied above
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/shipping-address', shippingAddressRoutes);
app.use('/api/cart', cartRoutes); // Enhanced cart routes
app.use('/api/orders', orderRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-types', userTypeRoutes);
app.use('/api/roles', userRoleRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/seo', cors(corsOptions), seoRoutes);
app.use('/api/video-call-enquiries', videoCallEnquiryRoutes);
app.use('/api/contact', contactRoutes);

// Request timeout middleware (30 seconds default, adjustable)
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 seconds
  res.setTimeout(30000);
  next();
});

// Health check endpoints with Swagger documentation
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 3600
 */
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(), 
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(), 
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'connected'
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Ratan Decor API Server is running', 
    version: '1.0.0',
    documentation: '/api-docs',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Ratan Decor API Server is running', 
    version: '1.0.0', 
    documentation: '/api-docs',
    endpoints: {
      health: '/health',
      apiHealth: '/api/health',
      documentation: '/api-docs',
      apiRoot: '/api'
    }
  });
});

// Enhanced 404 handlers with helpful information
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found', 
    path: req.path,
    method: req.method,
    availableEndpoints: [
      '/api/auth',
      '/api/products', 
      '/api/cart',
      '/api/orders',
      '/api/categories',
      '/api/users',
      '/api/enquiries'
    ]
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found', 
    path: req.path,
    availableRoutes: ['/', '/health', '/api', '/api-docs']
  });
});

// Enhanced global error handler
app.use((err, req, res, next) => {
  let statusCode = err.status || 500;
  let message = err.message || 'Internal Server Error';
  
  // Handle specific error types
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Validation error: ' + err.errors.map(e => e.message).join(', ');
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Duplicate entry error';
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Invalid reference to related data';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request entity too large';
  }
  
  // Log error details
  console.error('GLOBAL ERROR:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(statusCode).json({ 
    success: false, 
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      path: req.path 
    })
  });
});

// Server startup function
const startServer = async () => {
  try {
    console.log('🔄 Starting Ratan Decor API Server...');
    
    // Database connection
    console.log('📊 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Sync database
    console.log('🔄 Syncing database...');
    await sequelize.sync({ alter: false }); 
    console.log('✅ Database synced successfully');
    
    // Run migrations
    console.log('🔄 Running database migrations...');
    await runDatabaseMigrations();
    console.log('✅ Database migrations completed');
    
    // Initialize data
    console.log('🔄 Initializing system data...');
    await initializeUserTypes();
    console.log('✅ User types initialized');
    
    await initializeCategories();
    console.log('✅ Categories initialized');
    
    // Initialize SuperAdmin
    await initializeSuperAdmin();
    console.log('✅ SuperAdmin initialized');

    const PORT = process.env.PORT || 3000;

    const server = await new Promise((resolve, reject) => {
      const s = app.listen(PORT)
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`⚠️  Port ${PORT} in use, trying ${PORT}...`);
            resolve(app.listen(PORT + 1));
          } else {
            reject(err);
          }
        })
        .on('listening', () => {
          const actualPort = s.address().port;
          console.log(`🚀 Server running on port ${actualPort}`);
          console.log(`🌐 API URL: http://localhost:${actualPort}/api`);
          console.log(`📚 API Documentation: http://localhost:${actualPort}/api-docs`);
          console.log(`📄 API Spec JSON: http://localhost:${actualPort}/api-docs.json`);
          console.log(`🖼️  Image serving: http://localhost:${actualPort}/uploads/`);
          console.log('🔐 SuperAdmin Login:');
          console.log(`   Email: ${process.env.SUPERADMIN_EMAIL || 'superadmin@ratandecor.com'}`);
          console.log(`   Password: ${process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123'}`);
          resolve(s);
        });
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      console.log(`📴 ${signal} received, shutting down gracefully...`);
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
      
      // Force shutdown after 10 seconds
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

// Global error handlers
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