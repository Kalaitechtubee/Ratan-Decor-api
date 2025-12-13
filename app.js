// app.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const fs = require('fs');
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
const sliderRoutes = require('./slider/routes');
// Security middleware
const {
  sanitizeInput,
  auditLogger,
  trackSuspiciousActivity,
  rateLimits
} = require('./middleware/security');

const app = express();

const uploadsPath = path.join(__dirname, 'uploads');
const uploadSubdirs = ['products', 'categories', 'userTypes', 'sliders', 'defaults'];

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
  console.log(` ${subdir}: ${subdirPath}`);
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: 'no-referrer-when-downgrade' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.set('trust proxy', 1);

// ============================================================================
// CORS CONFIGURATION - WORKING VERSION
// ============================================================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://luxcycs.com',
  'http://luxcycs.com:3000',
  'http://www.luxcycs.com',
  'https://luxcycs.com',
  'https://www.luxcycs.com',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (Postman, mobile apps, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Check whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Development: Allow any localhost with any port
    if (process.env.NODE_ENV !== 'production' &&
        origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      return callback(null, true);
    }

    // Log rejection for debugging
    console.log('❌ CORS BLOCKED:', origin);
    console.log('   Allowed origins:', allowedOrigins.join(', '));

    const error = new Error(`CORS policy: Origin ${origin} is not allowed`);
    error.status = 403;
    callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cookie',
    'Cache-Control'
  ],
  exposedHeaders: ['X-Total-Count', 'X-New-Access-Token'],
  credentials: true,  // CRITICAL for cookies
  optionsSuccessStatus: 200,
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 🔥 Force credentials header in all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) ||
      (process.env.NODE_ENV !== 'production' && origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

console.log('🖼️ Setting up static file serving...');

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
  try {
    const requestedPath = req.path;
    const filePath = path.join(uploadsPath, requestedPath);
    console.log(`📥 Static file request: ${requestedPath}`);
    console.log(`📂 Looking for file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
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
      return res.status(404).json({
        success: false,
        message: 'File not found',
        path: requestedPath,
        fullPath: filePath,
        uploadsDir: uploadsPath
      });
    }
    
    console.log(`✅ File found, preparing to serve`);
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
      console.log(` Content-Type: ${contentTypeMap[ext]}`);
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${fs.statSync(filePath).mtime.getTime()}"`);
    
    console.log(`✅ Serving file: ${requestedPath}`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('❌ Static file serving error:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving file'
    });
  }
});

app.get('/api/images/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params;
    console.log(`📥 API image request: ${type}/${filename}`);
    
    const allowedTypes = ['products', 'categories', 'userTypes', 'sliders', 'defaults'];
    if (!allowedTypes.includes(type)) {
      console.log(`❌ Invalid type: ${type}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid image type',
        allowedTypes
      });
    }
    
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
    console.error('❌ Check file error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

console.log('✅ Static file serving configured');

app.use(trackSuspiciousActivity);
app.use(sanitizeInput);
app.use(auditLogger);

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
app.use('/api/sliders', sliderRoutes);

app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

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

app.get('/check', (req, res) => {
  res.send("working :)");
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

// Global error handler
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

module.exports = app;