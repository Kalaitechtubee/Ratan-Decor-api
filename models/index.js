// models/index.js
const Sequelize = require('sequelize');
const sequelize = require('../config/database');

// Define models
const User = sequelize.define('User', {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  role: {
    type: Sequelize.ENUM('General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support', 'customer'),
    defaultValue: 'General',
  },
  status: {
    type: Sequelize.ENUM('Pending', 'Approved', 'Rejected'),
    defaultValue: 'Pending',
  },
  mobile: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  address: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  country: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  state: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  city: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  pincode: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  company: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  gstNumber: {
    type: Sequelize.STRING,
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: false,
});

const Category = sequelize.define('Category', {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  parentId: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'categories',
  timestamps: false,
});

const Product = sequelize.define('Product', {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  description: {
    type: Sequelize.TEXT,
  },
  image: {
    type: Sequelize.STRING,
  },
  specifications: {
    type: Sequelize.JSON,
  },
  visibleTo: {
    type: Sequelize.JSON,
    defaultValue: ['Residential', 'Commercial', 'Modular Kitchen', 'Others'],
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
  },
  generalPrice: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false,
  },
  architectPrice: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false,
  },
  dealerPrice: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'products',
  timestamps: false,
});

const Enquiry = sequelize.define('Enquiry', {
  userType: {
    type: Sequelize.ENUM('Residential', 'Commercial', 'Modular Kitchen', 'Others'),
    allowNull: false,
  },
  source: {
    type: Sequelize.ENUM('Email', 'WhatsApp', 'Phone', 'VideoCall'),
    allowNull: false,
  },
  status: {
    type: Sequelize.ENUM('New', 'InProgress', 'Confirmed', 'Delivered', 'Rejected'),
    defaultValue: 'New',
  },
  notes: {
    type: Sequelize.TEXT,
  },
  videoCallDateTime: {
    type: Sequelize.DATE,
  },
}, {
  tableName: 'enquiries',
  timestamps: false,
});

const Address = sequelize.define('Address', {
  type: {
    type: Sequelize.ENUM('Billing', 'Shipping'),
    allowNull: false,
  },
  street: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  city: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  state: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  country: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  postalCode: {
    type: Sequelize.STRING,
    allowNull: false,
  },
}, {
  tableName: 'addresses',
  timestamps: false,
});

const Cart = sequelize.define('Cart', {
  quantity: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'carts',
  timestamps: false,
});

const Order = sequelize.define('Order', {
  status: {
    type: Sequelize.ENUM('Pending', 'Processing', 'Shipped', 'Completed', 'Cancelled'),
    defaultValue: 'Pending',
  },
  paymentMethod: {
    type: Sequelize.ENUM('Gateway', 'UPI', 'BankTransfer'),
    allowNull: false,
  },
  paymentStatus: {
    type: Sequelize.ENUM('Awaiting', 'Approved', 'Rejected'),
    defaultValue: 'Awaiting',
  },
  paymentProof: {
    type: Sequelize.STRING,
  },
  total: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'orders',
  timestamps: false,
});

const OrderItem = sequelize.define('OrderItem', {
  orderId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  productId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  quantity: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  price: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'order_items',
  timestamps: false,
});

// Associations
Category.hasMany(Category, { as: 'SubCategories', foreignKey: 'parentId' });
Category.belongsTo(Category, { as: 'Parent', foreignKey: 'parentId' });
Product.belongsTo(Category);
User.hasMany(Address);
Address.belongsTo(User);
User.hasMany(Cart);
Cart.belongsTo(User);
User.hasMany(Order);
Order.belongsTo(User);
User.hasMany(Enquiry);
Enquiry.belongsTo(User);
Order.hasMany(OrderItem, { foreignKey: 'orderId' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
Product.hasMany(OrderItem, { foreignKey: 'productId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(Cart);
Cart.belongsTo(Product);
Enquiry.belongsTo(Product);

// Database sync is handled in server.js

// Export models and Sequelize instance
const db = {
  User,
  Category,
  Product,
  Enquiry,
  Address,
  Cart,
  Order,
  OrderItem,
  sequelize, // Connection instance
  Sequelize, // Sequelize constructor
};

module.exports = db;