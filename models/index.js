// models/index.js
const Sequelize = require("sequelize");
const sequelize = require("../config/database");

// Import models
const UserTypeModel = require("../userType/models");
const UserModel = require("./User");
const ProductRatingModel = require("./ProductRating");
const Category = require("../category/models");
const Product = require("../product/models");
const Enquiry = require("../enquiry/models");
const Address = require("../address/models");
const ShippingAddress = require("../shipping-address/models");
const Cart = require("../cart/models");
const { Order, OrderItem } = require("../order/models");

// Import VideoCallEnquiry model
const VideoCallEnquiryModel = require("../VideoCallEnquiry/models");

// Initialize models
const UserType = UserTypeModel(sequelize, Sequelize.DataTypes);
const User = UserModel(sequelize, Sequelize.DataTypes);
const ProductRating = ProductRatingModel(sequelize, Sequelize.DataTypes);
const VideoCallEnquiry = VideoCallEnquiryModel(sequelize);

// --- Associations with CONSISTENT LOWERCASE ALIASES ---

// VideoCallEnquiry relations
User.hasMany(VideoCallEnquiry, { foreignKey: "userId", as: "videoCallEnquiries" });
VideoCallEnquiry.belongsTo(User, { foreignKey: "userId", as: "user" });

Product.hasMany(VideoCallEnquiry, { foreignKey: "productId", as: "videoCallEnquiries" });
VideoCallEnquiry.belongsTo(Product, { foreignKey: "productId", as: "product" });

// User & UserType associations
User.belongsTo(UserType, { foreignKey: "userTypeId", as: "userType" });
UserType.hasMany(User, { foreignKey: "userTypeId", as: "users" });

// Category self-associations
Category.hasMany(Category, { as: "subCategories", foreignKey: "parentId" });
Category.belongsTo(Category, { as: "parent", foreignKey: "parentId" });

// Product & Category associations
Product.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Category.hasMany(Product, { foreignKey: "categoryId", as: "products" });

// User & Address associations
User.hasMany(Address, { foreignKey: "userId", as: "addresses" });
Address.belongsTo(User, { foreignKey: "userId", as: "user" });

// User & ShippingAddress associations
User.hasMany(ShippingAddress, { foreignKey: "userId", as: "shippingAddresses" });
ShippingAddress.belongsTo(User, { foreignKey: "userId", as: "user" });

// User & Enquiry associations
User.hasMany(Enquiry, { foreignKey: "userId", as: "enquiries" });
Enquiry.belongsTo(User, { foreignKey: "userId", as: "user" });
Enquiry.belongsTo(User, { foreignKey: "assignedTo", as: "assignedUser" });

// User & Order associations
User.hasMany(Order, { foreignKey: "userId", as: "orders" });
Order.belongsTo(User, { foreignKey: "userId", as: "user" }); // ✅ lowercase

// User & Cart associations  
User.hasMany(Cart, { foreignKey: "userId", as: "cartItems" });
Cart.belongsTo(User, { foreignKey: "userId", as: "user" });

// Product & Cart associations - CRITICAL FIX
Product.hasMany(Cart, { foreignKey: "productId", as: "cartItems" });
Cart.belongsTo(Product, { foreignKey: "productId", as: "product" }); // ✅ lowercase 'product'

// Order & OrderItem associations
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems" }); // ✅ lowercase
OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });

// Product & OrderItem associations
Product.hasMany(OrderItem, { foreignKey: "productId", as: "orderItems" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" }); // ✅ lowercase

// Order & ShippingAddress associations
Order.belongsTo(ShippingAddress, { foreignKey: "shippingAddressId", as: "shippingAddress", allowNull: true }); // ✅ lowercase
ShippingAddress.hasMany(Order, { foreignKey: "shippingAddressId", as: "orders" });

// Enquiry & Product associations
Enquiry.belongsTo(Product, { foreignKey: "productId", as: "product" });
Product.hasMany(Enquiry, { foreignKey: "productId", as: "enquiries" });

// ProductRating associations
ProductRating.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(ProductRating, { foreignKey: "userId", as: "ratings" });

ProductRating.belongsTo(Product, { foreignKey: "productId", as: "product" });
Product.hasMany(ProductRating, { foreignKey: "productId", as: "ratings" });

console.log("✅ Model associations completed with consistent lowercase aliases");

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
  ProductRating,
  VideoCallEnquiry,
};