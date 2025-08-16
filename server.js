require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const path = require('path');
const rateLimit = require('express-rate-limit');

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

const { initializeCategories } = require('./category/initializeCategories');

const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again later.' }
});
app.use(limiter);

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
app.use('/api/user-roles', userRoleRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // One-time schema check to ensure paymentMethod includes COD
    const [results] = await sequelize.query("SHOW COLUMNS FROM orders LIKE 'paymentMethod'");
    const enumValues = results[0].Type.match(/ENUM\((.*?)\)/i)?.[1].split(',').map(val => val.replace(/'/g, '')) || [];
    if (!enumValues.includes('COD')) {
      console.log('🔧 Updating paymentMethod ENUM to include COD...');
      await sequelize.query("ALTER TABLE orders MODIFY COLUMN paymentMethod ENUM('Gateway', 'UPI', 'BankTransfer', 'COD') NOT NULL");
      console.log('✅ paymentMethod ENUM updated');
    }

    await sequelize.sync();
    console.log('✅ Database synchronized');

    await initializeCategories();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();