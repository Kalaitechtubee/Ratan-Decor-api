const Sequelize = require('sequelize');
const sequelize = require('../config/database');

const User = require('../auth/models');
const UserType = require('../userType/models');
const Category = require('../category/models');
const Product = require('../product/models');
const Enquiry = require('../enquiry/models');
const Address = require('../address/models');
const ShippingAddress = require('../shipping-address/models');
const Cart = require('../cart/models');
const OrderModels = require('../order/models');
const ProductRating = require('../product-rating/models');

const { Order, OrderItem } = OrderModels;

console.log('🔗 Setting up model associations...');

Category.hasMany(Category, { as: 'SubCategories', foreignKey: 'parentId' });
Category.belongsTo(Category, { as: 'Parent', foreignKey: 'parentId' });

Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'Category' });
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'Products' });

User.hasMany(Address, { foreignKey: 'userId', as: 'Addresses' });
Address.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(ShippingAddress, { foreignKey: 'userId', as: 'ShippingAddresses' });
ShippingAddress.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Enquiry, { foreignKey: 'userId', as: 'Enquiries' });
Enquiry.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Order, { foreignKey: 'userId', as: 'Orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Cart, { foreignKey: 'userId', as: 'CartItems' });
Cart.belongsTo(User, { foreignKey: 'userId', as: 'User' });

Product.hasMany(Cart, { foreignKey: 'productId', as: 'CartItems' });
Cart.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'OrderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'Order' });

Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'OrderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });

Order.belongsTo(ShippingAddress, { foreignKey: 'shippingAddressId', as: 'ShippingAddress', allowNull: true });
ShippingAddress.hasMany(Order, { foreignKey: 'shippingAddressId', as: 'Orders' });

Enquiry.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });
Product.hasMany(Enquiry, { foreignKey: 'productId', as: 'Enquiries' });

Product.hasMany(ProductRating, { foreignKey: 'productId', as: 'Ratings' });
ProductRating.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });

User.hasMany(ProductRating, { foreignKey: 'userId', as: 'ProductRatings' });
ProductRating.belongsTo(User, { foreignKey: 'userId', as: 'User' });

console.log('✅ Model associations completed');

const db = {
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
  ProductRating,
  sequelize,
  Sequelize,
};

module.exports = db;