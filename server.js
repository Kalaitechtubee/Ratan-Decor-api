require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const authRoutes = require('./auth/routes');
const productRoutes = require('./product/routes');
const addressRoutes = require('./address/routes');
const cartRoutes = require('./cart/routes');
const orderRoutes = require('./order/routes');
const profileRoutes = require('./profile/routes');

const adminRoutes = require('./admin/routes');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/profile', profileRoutes);

const { Category } = require('./models');

const initializeCategories = async () => {
  try {
    const categories = [
      { name: 'Plywood', subCategories: ['Commercial', 'Waterproof'] },
      { name: 'Mica', subCategories: ['1 mm Regular', '1 mm Texture', '1 mm Acrylic', '1.5 mm Acrylic', '2mm Acrylic', 'Color Core Mica', 'Metal Mica', 'Designer Mica'] },
      { name: 'Veneer', subCategories: ['Natural', 'Recon', 'Smoked', 'Dyed', 'Burl', 'Imported', 'Designer'] },
      { name: 'Flush Door & Frames', subCategories: ['Solid wood', 'Plain', 'PVC', 'Teak door frames', 'WPC door frames', 'Louvers'] },
      { name: 'PVC', subCategories: ['Charcoal', 'Solid wood', 'Flexi', 'Exterior', 'MDF', 'Metal'] },
      { name: 'Decorative sheets', subCategories: ['Albaster sheets', 'Corian Sheets', 'Highlighter sheets', 'Cane', 'Cork', 'Stone panels', 'Others'] }
    ];

    for (const category of categories) {
      const [parent, created] = await Category.findOrCreate({ where: { name: category.name } });
      for (const subCategory of category.subCategories) {
        await Category.findOrCreate({ 
          where: { name: subCategory }, 
          defaults: { parentId: parent.id } 
        });
      }
    }
    console.log('Categories initialized successfully');
  } catch (error) {
    console.error('Error initializing categories:', error);
    throw error;
  }
};

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');

    await sequelize.sync({ alter: false });
    console.log('Database schema synchronized');

    await initializeCategories();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();