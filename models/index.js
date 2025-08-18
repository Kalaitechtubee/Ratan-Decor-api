const Sequelize = require('sequelize');
const sequelize = require('../config/database');

// Import models
// Models that export a function
const UserTypeModel = require('../userType/models');
const UserType = UserTypeModel(sequelize, Sequelize.DataTypes);

const UserModel = require('./User');
const User = UserModel(sequelize, Sequelize.DataTypes);

// Models that export the model directly
const Category = require('../category/models');
const Product = require('../product/models');
const Enquiry = require('../enquiry/models');
const Address = require('../address/models');
const ShippingAddress = require('../shipping-address/models');
const Cart = require('../cart/models');

// Category <-> UserType
Category.belongsTo(UserType, { foreignKey: 'userTypeId', as: 'userType' });
UserType.hasMany(Category, { foreignKey: 'userTypeId', as: 'categories' });

// Category self relation
Category.hasMany(Category, { as: 'children', foreignKey: 'parentId' });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parentId' });

// Category <-> Product
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });

// User <-> Address
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User <-> ShippingAddress
User.hasMany(ShippingAddress, { foreignKey: 'userId', as: 'shippingAddresses' });
ShippingAddress.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User <-> Enquiry
User.hasMany(Enquiry, { foreignKey: 'userId', as: 'enquiries' });
Enquiry.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Import Order and OrderItem models
const { Order, OrderItem } = require('../order/models');

// User <-> Orders
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User <-> Cart
User.hasMany(Cart, { foreignKey: 'userId', as: 'cartItems' });
Cart.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Product.hasMany(Cart, { foreignKey: 'productId', as: 'cartItems' });
Cart.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Orders <-> OrderItems
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'orderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Orders <-> ShippingAddress
Order.belongsTo(ShippingAddress, { foreignKey: 'shippingAddressId', as: 'shippingAddress', allowNull: true });
ShippingAddress.hasMany(Order, { foreignKey: 'shippingAddressId', as: 'orders' });

// Enquiry <-> Product
Enquiry.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(Enquiry, { foreignKey: 'productId', as: 'enquiries' });

// User <-> UserType
User.belongsTo(UserType, { foreignKey: 'userTypeId', as: 'userType' });
UserType.hasMany(User, { foreignKey: 'userTypeId', as: 'users' });

console.log('✅ Model associations completed');

module.exports = {
  sequelize,
  Sequelize,
  User,
  UserType,
  Category,
  Product,
  Enquiry,
  Address,
  ShippingAddress,
  Cart,
  Order,
  OrderItem,
};