// Ratan Decor API Server - Complete Fixed Version
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const fs = require('fs');
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
  rateLimits
} = require('./middleware/security');

const app = express();

// ============================================================================
// VERIFY AND CREATE UPLOADS DIRECTORY
// ============================================================================
const uploadsPath = path.join(__dirname, 'uploads');
const uploadSubdirs = ['products', 'categories', 'userTypes', 'defaults'];

console.log('📁 Verifying uploads directory structure...');
console.log('📂 Absolute uploads path:', uploadsPath);

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true, mode: 0o755 });
  console.log('✅ Created uploads directory');
}

uploadSubdirs.forEach(subdir => {
  const subdirPath = path.join(uploadsPath, subdir);
  if (!fs.existsSync(subdirPath)) {
    fs.mkdirSync(subdirPath, { recursive: true, mode: 0o755 });
    console.log(`✅ Created ${subdir} subdirectory`);
  }
  console.log(`   ${subdir}: ${subdirPath}`);
});

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================
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

// ============================================================================
// CORS CONFIGURATION
// ============================================================================
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "Cache-Control",
    "Pragma"
  ],
  exposedHeaders: ["X-Total-Count"],
  credentials: true, 
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============================================================================
// BODY PARSING MIDDLEWARE
// ============================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// STATIC FILE SERVING - CRITICAL: MUST BE BEFORE SECURITY MIDDLEWARE
// ============================================================================
console.log('🖼️  Setting up static file serving...');

// Helper function to detect search engine bots
const isSearchEngineCrawler = (userAgent) => {
  if (!userAgent) return false;
  const crawlerPatterns = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebot/i,
    /ia_archiver/i
  ];
  return crawlerPatterns.some(pattern => pattern.test(userAgent));
};

// Handle OPTIONS requests for CORS preflight on uploads
app.options('/uploads/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Serve uploaded files with proper headers
app.use('/uploads', (req, res, next) => {
  const requestedPath = req.path;
  const filePath = path.join(uploadsPath, requestedPath);

  console.log(`📥 Static file request: ${requestedPath}`);
  console.log(`📂 Looking for file: ${filePath}`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);

    // Try to serve default image for products
    if (requestedPath.includes('/products/')) {
      const defaultImagePath = path.join(uploadsPath, 'defaults', 'no-image.png');
      if (fs.existsSync(defaultImagePath)) {
        console.log('📦 Serving default image');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.sendFile(defaultImagePath);
      }
    }

    // Return 404 without calling next() to prevent frontend routing from catching this
    return res.status(404).json({
      success: false,
      message: 'File not found',
      path: requestedPath,
      fullPath: filePath,
      uploadsDir: uploadsPath
    });
  }

  console.log(`✅ File found, preparing to serve`);

  // Set content type based on extension
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
    console.log(`   Content-Type: ${contentTypeMap[ext]}`);
  }

  // Set CORS and caching headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('ETag', `"${fs.statSync(filePath).mtime.getTime()}"`);

  console.log(`✅ Serving file: ${requestedPath}`);
  res.sendFile(filePath);
});

// Alternative image serving endpoint with explicit file serving
app.get('/api/images/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params;
    
    console.log(`📥 API image request: ${type}/${filename}`);
    
    const allowedTypes = ['products', 'categories', 'userTypes', 'defaults'];
    if (!allowedTypes.includes(type)) {
      console.log(`❌ Invalid type: ${type}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid image type',
        allowedTypes
      });
    }
    
    // Security check: prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      console.log(`❌ Invalid filename: ${filename}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    const imagePath = path.join(uploadsPath, type, filename);
    console.log(`📂 Full path: ${imagePath}`);
    
    if (!fs.existsSync(imagePath)) {
      console.log(`❌ Image not found: ${imagePath}`);
      
      // Try to serve default image
      const defaultImagePath = path.join(uploadsPath, 'defaults', 'no-image.png');
      if (fs.existsSync(defaultImagePath)) {
        console.log('📦 Serving default image');
        return res.sendFile(defaultImagePath);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Image not found',
        filename,
        type,
        path: imagePath
      });
    }
    
    // Set appropriate content type
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
    
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    console.log(`✅ API serving image: ${type}/${filename}`);
    res.sendFile(imagePath);
    
  } catch (error) {
    console.error('❌ IMAGE SERVING ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving image',
      error: error.message
    });
  }
});

// Diagnostic endpoint to check file existence
app.get('/api/check-file/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params;
    const filePath = path.join(uploadsPath, type, filename);
    const exists = fs.existsSync(filePath);
    
    let directoryContents = [];
    if (!exists) {
      try {
        const dirPath = path.join(uploadsPath, type);
        if (fs.existsSync(dirPath)) {
          directoryContents = fs.readdirSync(dirPath).slice(0, 20);
        }
      } catch (err) {
        console.error('Error reading directory:', err);
      }
    }
    
    res.json({
      success: true,
      exists,
      requestedFile: filename,
      type,
      fullPath: filePath,
      uploadsDir: uploadsPath,
      directoryContents: !exists ? directoryContents : undefined,
      fileStats: exists ? fs.statSync(filePath) : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('✅ Static file serving configured');

// ============================================================================
// SECURITY MIDDLEWARE - MUST BE AFTER STATIC FILES
// ============================================================================
app.use(trackSuspiciousActivity);
app.use(sanitizeInput);
app.use(auditLogger);

// ============================================================================
// RATE LIMITING
// ============================================================================
const skipRateLimit = (req) => {
  const userAgent = req.get('User-Agent') || '';
  return req.path === '/health' || 
         req.path === '/api/health' || 
         req.path.startsWith('/api-docs') ||
         req.path.startsWith('/uploads') ||
         req.path.startsWith('/api/images') ||
         req.path.startsWith('/api/check-file') ||
         isSearchEngineCrawler(userAgent);
};

// Apply rate limiters
app.use('/api/auth', rateLimits.auth, authRoutes);
app.use('/api/auth/register', rateLimits.register);
app.use('/api/auth/otp', rateLimits.otp);
app.use('/api/admin', rateLimits.admin, adminRoutes);
app.use('/api', rateLimits.general);

// ============================================================================
// SWAGGER DOCUMENTATION
// ============================================================================
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

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ============================================================================
// API ROUTES
// ============================================================================
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/shipping-address', shippingAddressRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-types', userTypeRoutes);
app.use('/api/roles', userRoleRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/seo', cors(corsOptions), seoRoutes);
app.use('/api/video-call-enquiries', videoCallEnquiryRoutes);
app.use('/api/contact', contactRoutes);

// ============================================================================
// REQUEST TIMEOUT
// ============================================================================
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================
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
    database: 'connected',
    uploadsPath: uploadsPath
  });
});

app.get('/api', (req, res) => {
  res.json({ 
    message: 'Ratan Decor API Server is running', 
    version: '1.0.0',
    documentation: '/api-docs',
    timestamp: new Date().toISOString()
  });
});

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
      apiRoot: '/api',
      uploads: '/uploads',
      imageApi: '/api/images/{type}/{filename}',
      checkFile: '/api/check-file/{type}/{filename}'
    }
  });
});

// ============================================================================
// 404 HANDLERS
// ============================================================================
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
      '/api/enquiries',
      '/uploads',
      '/api/images'
    ]
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found', 
    path: req.path,
    availableRoutes: ['/', '/health', '/api', '/api-docs', '/uploads']
  });
});

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================
app.use((err, req, res, next) => {
  let statusCode = err.status || 500;
  let message = err.message || 'Internal Server Error';
  
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
  
  if (message !== 'Not allowed by CORS') {
    console.error('❌ GLOBAL ERROR:', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  res.status(statusCode).json({ 
    success: false, 
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      path: req.path 
    })
  });
});

// ============================================================================
// DATABASE MIGRATIONS
// ============================================================================
const runDatabaseMigrations = async () => {
  try {
    // SEO configuration
    const seoConfig = [
      { pageName: 'home', title: 'Home - Ratan Decor', description: 'Welcome to Ratan Decor, your one-stop shop for premium home decor.', keywords: 'home, ratan decor, home decor' },
      { pageName: 'products', title: 'Products - Ratan Decor', description: 'Browse our exclusive collection of home decor products.', keywords: 'products, shopping, home decor' },
      { pageName: 'productdetails', title: 'Product Details - Ratan Decor', description: 'View detailed information about our home decor products.', keywords: 'product, details, home decor' },
      { pageName: 'cart', title: 'Your Cart - Ratan Decor', description: 'Review items in your shopping cart.', keywords: 'cart, checkout, shopping' },
      { pageName: 'checkout', title: 'Checkout - Ratan Decor', description: 'Complete your purchase securely.', keywords: 'checkout, payment, shopping' },
      { pageName: 'order-success', title: 'Order Success - Ratan Decor', description: 'Thank you for your order!', keywords: 'order, success' },
      { pageName: 'about', title: 'About Us - Ratan Decor', description: 'Learn about Ratan Decor and our mission.', keywords: 'about, company' },
      { pageName: 'contact', title: 'Contact Us - Ratan Decor', description: 'Get in touch with our support team.', keywords: 'contact, support' },
      { pageName: 'privacy', title: 'Privacy Policy - Ratan Decor', description: 'Understand our privacy practices.', keywords: 'privacy, policy' },
      { pageName: 'terms', title: 'Terms & Conditions - Ratan Decor', description: 'Read our terms and conditions.', keywords: 'terms, conditions' },
      { pageName: 'cookiespolicy', title: 'Cookies Policy - Ratan Decor', description: 'Learn how we use cookies.', keywords: 'cookies, policy' },
      { pageName: 'returns', title: 'Returns & Refunds - Ratan Decor', description: 'Understand our return policy.', keywords: 'returns, refunds' },
      { pageName: 'disclaimer', title: 'Disclaimer - Ratan Decor', description: 'Read our legal disclaimer.', keywords: 'disclaimer, legal' },
      { pageName: 'faq', title: 'FAQ - Ratan Decor', description: 'Find answers to frequently asked questions.', keywords: 'faq, help' },
      { pageName: 'profile', title: 'Profile - Ratan Decor', description: 'Manage your account settings.', keywords: 'profile, account' },
      { pageName: 'orderdetails', title: 'Order Details - Ratan Decor', description: 'View your order details.', keywords: 'order, details' },
      { pageName: 'VideoCall', title: 'Video Call - Ratan Decor', description: 'Connect with our experts via video call.', keywords: 'video call, support' },
    ];

    // Run all migrations
    const [imagesResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'images' AND TABLE_SCHEMA = DATABASE()
    `);
    if (imagesResults.length === 0) {
      await sequelize.query(`ALTER TABLE products ADD COLUMN images JSON DEFAULT (JSON_ARRAY())`);
      console.log('✅ Added images column to products table');
    }

    const [warrantyResults] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'warranty' AND TABLE_SCHEMA = DATABASE()
    `);
    if (warrantyResults.length === 0) {
      await sequelize.query(`ALTER TABLE products ADD COLUMN warranty VARCHAR(255) DEFAULT NULL`);
      console.log('✅ Added warranty column to products table');
    }

    // SuperAdmin role check
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
      }
    } catch (error) {
      console.log('⚠️  SuperAdmin role already exists or error:', error.message);
    }

    // SEO table
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS seo (
          id INTEGER PRIMARY KEY AUTO_INCREMENT,
          pageName VARCHAR(255) NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          keywords TEXT,
          createdAt DATETIME NOT NULL,
          updatedAt DATETIME NOT NULL
        )
      `);
      console.log('✅ SEO table ready');

      for (const seo of seoConfig) {
        const [results] = await sequelize.query(`SELECT COUNT(*) as count FROM seo WHERE pageName = ?`, { replacements: [seo.pageName] });
        if (results[0].count === 0) {
          await sequelize.query(`
            INSERT INTO seo (pageName, title, description, keywords, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, NOW(), NOW())
          `, { replacements: [seo.pageName, seo.title, seo.description, seo.keywords] });
        }
      }
      console.log('✅ SEO table populated');
    } catch (error) {
      console.log('⚠️  SEO table setup skipped:', error.message);
    }
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
};

// ============================================================================
// SERVER STARTUP
// ============================================================================
const startServer = async () => {
  try {
    console.log('🔄 Starting Ratan Decor API Server...');
    
    console.log('📊 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    console.log('🔄 Running database migrations...');
    await runDatabaseMigrations();
    console.log('✅ Database migrations completed');

    console.log('🔄 Syncing database...');
    await sequelize.sync({ alter: false });
    console.log('✅ Database synced successfully');
    
    console.log('🔄 Initializing system data...');
    await initializeUserTypes();
    console.log('✅ User types initialized');
    
    await initializeCategories();
    console.log('✅ Categories initialized');
    
    await initializeSuperAdmin();
    console.log('✅ SuperAdmin initialized');

    const PORT = process.env.PORT || 3000;

    const server = await new Promise((resolve, reject) => {
      const s = app.listen(PORT)
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`⚠️  Port ${PORT} in use, trying ${PORT + 1}...`);
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
          console.log(`🖼️  Static uploads: http://localhost:${actualPort}/uploads/`);
          console.log(`🖼️  Image API: http://localhost:${actualPort}/api/images/{type}/{filename}`);
          console.log(`🔍 Check file: http://localhost:${actualPort}/api/check-file/{type}/{filename}`);
          console.log('');
          console.log('🔐 SuperAdmin Credentials:');
          console.log(`   📧 Email: ${process.env.SUPERADMIN_EMAIL || 'superadmin@ratandecor.com'}`);
          console.log(`   🔑 Password: ${process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123'}`);
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

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================
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