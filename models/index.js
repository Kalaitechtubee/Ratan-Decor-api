// Updated models/index.js - Add EnquiryInternalNote
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
const VideoCallEnquiryModel = require("../VideoCallEnquiry/models");
const VideoCallInternalNoteModel = require("../VideoCallEnquiry/internalNoteModels");
const EnquiryInternalNoteModel = require("../enquiry/EnquiryInternalNote"); // NEW

// Initialize models
const UserType = UserTypeModel(sequelize, Sequelize.DataTypes);
const User = UserModel(sequelize, Sequelize.DataTypes);
const ProductRating = ProductRatingModel(sequelize, Sequelize.DataTypes);
const VideoCallEnquiry = VideoCallEnquiryModel(sequelize);
const VideoCallInternalNote = VideoCallInternalNoteModel(sequelize);
const EnquiryInternalNote = EnquiryInternalNoteModel(sequelize); // NEW

// --- Associations with CONSISTENT LOWERCASE ALIASES ---

// User self-association (createdBy)
User.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
User.hasMany(User, { foreignKey: "createdBy", as: "createdUsers" });

// VideoCallEnquiry relations
User.hasMany(VideoCallEnquiry, { foreignKey: "userId", as: "videoCallEnquiries" });
VideoCallEnquiry.belongsTo(User, { foreignKey: "userId", as: "user" });

Product.hasMany(VideoCallEnquiry, { foreignKey: "productId", as: "videoCallEnquiries" });
VideoCallEnquiry.belongsTo(Product, { foreignKey: "productId", as: "product" });

// VideoCallInternalNote relations
VideoCallEnquiry.hasMany(VideoCallInternalNote, { foreignKey: "enquiryId", as: "internalNotes" });
VideoCallInternalNote.belongsTo(VideoCallEnquiry, { foreignKey: "enquiryId", as: "enquiry" });

User.hasMany(VideoCallInternalNote, { foreignKey: "staffUserId", as: "videoCallStaffNotes" });
VideoCallInternalNote.belongsTo(User, { foreignKey: "staffUserId", as: "staffUser" });

// NEW: EnquiryInternalNote relations
Enquiry.hasMany(EnquiryInternalNote, { foreignKey: "enquiryId", as: "internalNotes" });
EnquiryInternalNote.belongsTo(Enquiry, { foreignKey: "enquiryId", as: "enquiry" });

User.hasMany(EnquiryInternalNote, { foreignKey: "staffUserId", as: "enquiryStaffNotes" });
EnquiryInternalNote.belongsTo(User, { foreignKey: "staffUserId", as: "staffUser" });

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
Order.belongsTo(User, { foreignKey: "userId", as: "user" });

// User & Cart associations  
User.hasMany(Cart, { foreignKey: "userId", as: "cartItems" });
Cart.belongsTo(User, { foreignKey: "userId", as: "user" });

// Product & Cart associations
Product.hasMany(Cart, { foreignKey: "productId", as: "cartItems" });
Cart.belongsTo(Product, { foreignKey: "productId", as: "product" });

// Order & OrderItem associations
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems" });
OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });

// Product & OrderItem associations
Product.hasMany(OrderItem, { foreignKey: "productId", as: "orderItems" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" });

// Order & ShippingAddress associations
Order.belongsTo(ShippingAddress, { foreignKey: "shippingAddressId", as: "shippingAddress", allowNull: true });
ShippingAddress.hasMany(Order, { foreignKey: "shippingAddressId", as: "orders" });

// Enquiry & Product associations
Enquiry.belongsTo(Product, { foreignKey: "productId", as: "product" });
Product.hasMany(Enquiry, { foreignKey: "productId", as: "enquiries" });

// Enquiry & UserType associations
Enquiry.belongsTo(UserType, { foreignKey: "userType", as: "userTypeData" });
UserType.hasMany(Enquiry, { foreignKey: "userType", as: "enquiries" });

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
  VideoCallInternalNote,
  EnquiryInternalNote, // NEW
};