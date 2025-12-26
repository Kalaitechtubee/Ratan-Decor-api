const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const UserTypeModel = require("../userType/models");
const UserModel = require("./User");
const ProductRatingModel = require("./ProductRating");
const Category = require("../category/models");
const Product = require("../product/models");
const Enquiry = require("../enquiry/models")(sequelize, Sequelize.DataTypes);
const Address = require("../address/models");
const ShippingAddress = require("../shipping-address/models");
const Cart = require("../cart/models");
// Use internal spread to get Order and OrderItem if exported as object
const OrderModels = require("../order/models");
const Order = OrderModels.Order;
const OrderItem = OrderModels.OrderItem;

const VideoCallEnquiryModel = require("../VideoCallEnquiry/models");
const VideoCallInternalNoteModel = require("../VideoCallEnquiry/internalNoteModels");
const EnquiryInternalNoteModel = require("../enquiry/EnquiryInternalNote");
const Slider = require("../slider/models");

const UserType = UserTypeModel(sequelize, Sequelize.DataTypes);
const User = UserModel(sequelize, Sequelize.DataTypes);
const ProductRating = ProductRatingModel(sequelize, Sequelize.DataTypes);
const VideoCallEnquiry = VideoCallEnquiryModel(sequelize);
const VideoCallInternalNote = VideoCallInternalNoteModel(sequelize);
const EnquiryInternalNote = EnquiryInternalNoteModel(sequelize);

// ===================================
// USER & AUTH Associations
// ===================================
// UserType <-> User
UserType.hasMany(User, { foreignKey: "userTypeId", as: "users" });
User.belongsTo(UserType, { foreignKey: "userTypeId", as: "userType" });

// User Hierarchies (Created By)
User.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
User.hasMany(User, { foreignKey: "createdBy", as: "createdUsers" });

// User Addresses
User.hasMany(Address, { foreignKey: "userId", as: "addresses", onDelete: 'CASCADE' });
Address.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(ShippingAddress, { foreignKey: "userId", as: "shippingAddresses", onDelete: 'CASCADE' });
ShippingAddress.belongsTo(User, { foreignKey: "userId", as: "user" });


// ===================================
// PRODUCT & CATEGORY Associations
// ===================================
// Category Hierarchy
Category.hasMany(Category, { foreignKey: 'parentId', as: 'subCategories', onDelete: 'CASCADE' });
Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });

// Category <-> Product
Category.hasMany(Product, { foreignKey: "categoryId", as: "products" });
Product.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

// Product Ratings
User.hasMany(ProductRating, { foreignKey: "userId", as: "ratings", onDelete: 'CASCADE' });
ProductRating.belongsTo(User, { foreignKey: "userId", as: "user" });

Product.hasMany(ProductRating, { foreignKey: "productId", as: "ratings", onDelete: 'CASCADE' });
ProductRating.belongsTo(Product, { foreignKey: "productId", as: "product" });


// ===================================
// ORDER & CART Associations
// ===================================
// Cart
User.hasMany(Cart, { foreignKey: "userId", as: "cartItems", onDelete: 'CASCADE' });
Cart.belongsTo(User, { foreignKey: "userId", as: "user" });

Product.hasMany(Cart, { foreignKey: "productId", as: "cartItems", onDelete: 'CASCADE' });
Cart.belongsTo(Product, { foreignKey: "productId", as: "product" });

// Order
User.hasMany(Order, { foreignKey: "userId", as: "orders" });
Order.belongsTo(User, { foreignKey: "userId", as: "user" });

ShippingAddress.hasMany(Order, { foreignKey: "shippingAddressId", as: "orders" });
Order.belongsTo(ShippingAddress, { foreignKey: "shippingAddressId", as: "shippingAddress" });

// Order Items
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems", onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });

Product.hasMany(OrderItem, { foreignKey: "productId", as: "orderItems" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" });


// ===================================
// ENQUIRY (General) Associations
// ===================================
User.hasMany(Enquiry, { foreignKey: "userId", as: "enquiries" });
Enquiry.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Enquiry, { foreignKey: "assignedTo", as: "assignedEnquiries" });
Enquiry.belongsTo(User, { foreignKey: "assignedTo", as: "assignedUser" }); // Fixed: FK 'assignedTo', Alias 'assignedUser'

Product.hasMany(Enquiry, { foreignKey: "productId", as: "enquiries" });
Enquiry.belongsTo(Product, { foreignKey: "productId", as: "product" });

UserType.hasMany(Enquiry, { foreignKey: "userType", as: "enquiries" });
Enquiry.belongsTo(UserType, { foreignKey: "userType", as: "userTypeData" });

// Enquiry Notes
Enquiry.hasMany(EnquiryInternalNote, { foreignKey: "enquiryId", as: "internalNotes", onDelete: 'CASCADE' });
EnquiryInternalNote.belongsTo(Enquiry, { foreignKey: "enquiryId", as: "enquiry" });

User.hasMany(EnquiryInternalNote, { foreignKey: "staffUserId", as: "enquiryStaffNotes" });
EnquiryInternalNote.belongsTo(User, { foreignKey: "staffUserId", as: "staffUser" });

User.hasMany(EnquiryInternalNote, { foreignKey: "userId", as: "enquiryUserNotes" });
EnquiryInternalNote.belongsTo(User, { foreignKey: "userId", as: "user" });

Product.hasMany(EnquiryInternalNote, { foreignKey: "productId", as: "enquiryProductNotes" });
EnquiryInternalNote.belongsTo(Product, { foreignKey: "productId", as: "product" });


// ===================================
// VIDEO CALL ENQUIRY Associations
// ===================================
User.hasMany(VideoCallEnquiry, { foreignKey: "userId", as: "videoCallEnquiries" });
VideoCallEnquiry.belongsTo(User, { foreignKey: "userId", as: "user" });

Product.hasMany(VideoCallEnquiry, { foreignKey: "productId", as: "videoCallEnquiries" });
VideoCallEnquiry.belongsTo(Product, { foreignKey: "productId", as: "product" });

// Video Call Notes
VideoCallEnquiry.hasMany(VideoCallInternalNote, { foreignKey: "enquiryId", as: "internalNotes", onDelete: 'CASCADE' });
VideoCallInternalNote.belongsTo(VideoCallEnquiry, { foreignKey: "enquiryId", as: "enquiry" });

User.hasMany(VideoCallInternalNote, { foreignKey: "staffUserId", as: "videoCallStaffNotes" });
VideoCallInternalNote.belongsTo(User, { foreignKey: "staffUserId", as: "staffUser" });

User.hasMany(VideoCallInternalNote, { foreignKey: "userId", as: "videoCallUserNotes" });
VideoCallInternalNote.belongsTo(User, { foreignKey: "userId", as: "user" });

Product.hasMany(VideoCallInternalNote, { foreignKey: "productId", as: "videoCallProductNotes" });
VideoCallInternalNote.belongsTo(Product, { foreignKey: "productId", as: "product" });


// ===================================
// EXPORTS
// ===================================
const db = {
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
  EnquiryInternalNote,
  Slider
};

// Check for any model-specific "associate" methods (legacy support)
Object.values(db).forEach(model => {
  if (model && model.associate) {
    // We have defined associations manually above, so we might want to skip or double-check.
    // For now, let's silence this to prevent duplicates if we cleaned up the models.
    // model.associate(db); 
  }
});

console.log("✅ Model associations completed and registered.");

module.exports = db;