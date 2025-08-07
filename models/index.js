// models/index.js
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { 
    type: DataTypes.ENUM('General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support'), 
    defaultValue: 'General' 
  },
  status: { 
    type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), 
    defaultValue: 'Pending' 
  }
});

const Category = sequelize.define('Category', {
  name: { type: DataTypes.STRING, allowNull: false },
  parentId: { type: DataTypes.INTEGER, allowNull: true }
});

const Product = sequelize.define('Product', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  image: { type: DataTypes.STRING },
  specifications: { type: DataTypes.JSON },
  visibleTo: { 
    type: DataTypes.JSON, 
    defaultValue: ['Residential', 'Commercial', 'Modular Kitchen', 'Others'] 
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  generalPrice: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  architectPrice: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  dealerPrice: { type: DataTypes.DECIMAL(10,2), allowNull: false }
});

const Enquiry = sequelize.define('Enquiry', {
  userType: { type: DataTypes.ENUM('Residential', 'Commercial', 'Modular Kitchen', 'Others'), allowNull: false },
  source: { type: DataTypes.ENUM('Email', 'WhatsApp', 'Phone', 'VideoCall'), allowNull: false },
  status: { type: DataTypes.ENUM('New', 'InProgress', 'Confirmed', 'Delivered', 'Rejected'), defaultValue: 'New' },
  notes: { type: DataTypes.TEXT },
  videoCallDateTime: { type: DataTypes.DATE }
});

const Address = sequelize.define('Address', {
  type: { type: DataTypes.ENUM('Billing', 'Shipping'), allowNull: false },
  street: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false },
  state: { type: DataTypes.STRING, allowNull: false },
  country: { type: DataTypes.STRING, allowNull: false },
  postalCode: { type: DataTypes.STRING, allowNull: false }
});

const Cart = sequelize.define('Cart', {
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
});

const Order = sequelize.define('Order', {
  status: { 
    type: DataTypes.ENUM('Pending', 'Processing', 'Shipped', 'Completed', 'Cancelled'), 
    defaultValue: 'Pending' 
  },
  paymentMethod: { type: DataTypes.ENUM('Gateway', 'UPI', 'BankTransfer'), allowNull: false },
  paymentStatus: { type: DataTypes.ENUM('Awaiting', 'Approved', 'Rejected'), defaultValue: 'Awaiting' },
  paymentProof: { type: DataTypes.STRING },
  total: { type: DataTypes.DECIMAL(10,2), allowNull: false }
});

const OrderItem = sequelize.define('OrderItem', {
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  price: { type: DataTypes.DECIMAL(10,2), allowNull: false }
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

// Sync database
sequelize.sync();

module.exports = { User, Category, Product, Enquiry, Address, Cart, Order, OrderItem };