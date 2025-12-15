
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

/* -------------------- Swagger -------------------- */
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

/* -------------------- Routes -------------------- */
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

/* -------------------- Security Middleware -------------------- */
const {
  sanitizeInput,
  auditLogger,
  trackSuspiciousActivity,
  rateLimits
} = require('./middleware/security');

const app = express();

/* =============================================================
   FILE UPLOAD SETUP
============================================================= */
const uploadsPath = path.join(__dirname, 'uploads');
const uploadFolders = ['products', 'categories', 'userTypes', 'sliders', 'defaults'];

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true, mode: 0o755 });
}

uploadFolders.forEach(folder => {
  const dir = path.join(uploadsPath, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
});

/* =============================================================
   SECURITY HEADERS
============================================================= */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer-when-downgrade' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:', 'blob:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'", 'http://localhost:*', 'http://127.0.0.1:*'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        mediaSrc: ["'self'"]
      }
    }
  })
);

app.set('trust proxy', 1);

/* =============================================================
   CORS CONFIGURATION
============================================================= */
const corsOptions = {
  origin: true,
  credentials: true,
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
  maxAge: 86400
};

app.use(cors(corsOptions));

/* =============================================================
   BODY & COOKIE PARSERS
============================================================= */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

/* =============================================================
   DYNAMIC CORS HELPER
============================================================= */
const setDynamicCorsHeaders = (req, res) => {
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
};

/* =============================================================
   STATIC FILE SERVING (/uploads)
============================================================= */
app.options('/uploads/*', (req, res) => {
  setDynamicCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.use('/uploads', (req, res) => {
  try {
    const filePath = path.join(uploadsPath, req.path);

    if (!fs.existsSync(filePath)) {
      const fallback = path.join(uploadsPath, 'defaults', 'no-image.png');
      if (fs.existsSync(fallback)) {
        setDynamicCorsHeaders(req, res);
        return res.sendFile(fallback);
      }
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    setDynamicCorsHeaders(req, res);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(filePath);
  } catch (err) {
    console.error('Upload serve error:', err);
    res.status(500).json({ success: false, message: 'Error serving file' });
  }
});

/* =============================================================
   GLOBAL SECURITY MIDDLEWARE
============================================================= */
app.use(trackSuspiciousActivity);
app.use(sanitizeInput);
app.use(auditLogger);

/* =============================================================
   RATE LIMITS
============================================================= */
app.use('/api/auth', rateLimits.auth, authRoutes);
app.use('/api/auth/register', rateLimits.register);
app.use('/api/auth/otp', rateLimits.otp);
app.use('/api/admin', rateLimits.admin, adminRoutes);
app.use('/api', rateLimits.general);

/* =============================================================
   API ROUTES
============================================================= */
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
app.use('/api/seo', seoRoutes);
app.use('/api/video-call-enquiries', videoCallEnquiryRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/sliders', sliderRoutes);

/* =============================================================
   SWAGGER
============================================================= */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_, res) => res.json(swaggerSpec));

/* =============================================================
   SYSTEM ROUTES
============================================================= */
app.get('/health', (_, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is healthy and running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});


app.get('/', (_, res) => {
  res.json({
    success: true,
    message: 'Ratan Decor API Server is running',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

/* =============================================================
   404 HANDLERS
============================================================= */
app.use('/api/*', (_, res) =>
  res.status(404).json({ success: false, message: 'API endpoint not found' })
);

app.use('*', (_, res) =>
  res.status(404).json({ success: false, message: 'Endpoint not found' })
);

/* =============================================================
   GLOBAL ERROR HANDLER
============================================================= */
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name?.startsWith('Sequelize')) {
    status = 400;
    message = err.errors?.map(e => e.message).join(', ') || message;
  }

  console.error('GLOBAL ERROR:', err);

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
