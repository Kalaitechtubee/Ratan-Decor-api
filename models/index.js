// models/index.js
const Sequelize = require('sequelize');
const sequelize = require('../config/database');

// Import all models from their respective folders
const User = require('../auth/models');
const UserType = require('../userType/models');
const CustomerType = require('../customerType/models');
const Category = require('../category/models');
const Product = require('../product/models');
const ProductUsageType = require('./productUsageType');
const Enquiry = require('../enquiry/models');
const Address = require('../address/models');
const ShippingAddress = require('../shipping-address/models');
const Cart = require('../cart/models');
const OrderModels = require('../order/models');
const ProductRating = require('../product-rating/models');

// Destructure Order models
const { Order, OrderItem } = OrderModels;

// ========================================
// MODEL ASSOCIATIONS
// ========================================
console.log('🔗 Setting up model associations...');

// Category associations (self-referencing)
Category.hasMany(Category, { as: 'SubCategories', foreignKey: 'parentId' });
Category.belongsTo(Category, { as: 'Parent', foreignKey: 'parentId' });

// Product associations
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'Category' });
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'Products' });

Product.belongsTo(ProductUsageType, { foreignKey: 'productUsageTypeId', as: 'UsageType' });
ProductUsageType.hasMany(Product, { foreignKey: 'productUsageTypeId', as: 'Products' });
// User associations
User.hasMany(Address, { foreignKey: 'userId', as: 'Addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(ShippingAddress, { foreignKey: 'userId', as: 'ShippingAddresses' });
ShippingAddress.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Enquiry, { foreignKey: 'userId', as: 'Enquiries' });
Enquiry.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Order, { foreignKey: 'userId', as: 'Orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'User' });

// Cart associations
User.hasMany(Cart, { foreignKey: 'userId', as: 'CartItems' });
Cart.belongsTo(User, { foreignKey: 'userId', as: 'User' });

Product.hasMany(Cart, { foreignKey: 'productId', as: 'CartItems' });
Cart.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });

// Order associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'OrderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'Order' });

Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'OrderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });

// Enquiry associations
Enquiry.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });
Product.hasMany(Enquiry, { foreignKey: 'productId', as: 'Enquiries' });

// Product Rating associations
Product.hasMany(ProductRating, { foreignKey: 'productId', as: 'Ratings' });
ProductRating.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });

User.hasMany(ProductRating, { foreignKey: 'userId', as: 'ProductRatings' });
ProductRating.belongsTo(User, { foreignKey: 'userId', as: 'User' });

console.log('✅ Model associations completed');

// ========================================
// EXPORT MODELS
// ========================================
const db = {
  User,
  UserType,
  CustomerType,
  Category,
  Product,
  ProductUsageType,
  Enquiry,
  Address,
  ShippingAddress,
  Cart,
  Order,
  OrderItem,
  ProductRating,
  sequelize,
  Sequelize,
};

module.exports = db;