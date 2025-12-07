
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
const { Order, OrderItem } = require("../order/models");
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




User.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
User.hasMany(User, { foreignKey: "createdBy", as: "createdUsers" });

User.hasMany(VideoCallEnquiry, { foreignKey: "userId", as: "videoCallEnquiries" });
VideoCallEnquiry.belongsTo(User, { foreignKey: "userId", as: "user" });

Product.hasMany(VideoCallEnquiry, { foreignKey: "productId", as: "videoCallEnquiries" });
VideoCallEnquiry.belongsTo(Product, { foreignKey: "productId", as: "product" });


VideoCallEnquiry.hasMany(VideoCallInternalNote, { foreignKey: "enquiryId", as: "internalNotes" });
VideoCallInternalNote.belongsTo(VideoCallEnquiry, { foreignKey: "enquiryId", as: "enquiry" });

User.hasMany(VideoCallInternalNote, { foreignKey: "staffUserId", as: "videoCallStaffNotes" });
VideoCallInternalNote.belongsTo(User, { foreignKey: "staffUserId", as: "staffUser" });

User.hasMany(VideoCallInternalNote, { foreignKey: "userId", as: "videoCallNotes" });
Product.hasMany(VideoCallInternalNote, { foreignKey: "productId", as: "videoCallNotes" });

VideoCallInternalNote.belongsTo(User, { foreignKey: "userId", as: "user" });
VideoCallInternalNote.belongsTo(Product, { foreignKey: "productId", as: "product" });


Enquiry.hasMany(EnquiryInternalNote, { foreignKey: "enquiryId", as: "internalNotes" });
EnquiryInternalNote.belongsTo(Enquiry, { foreignKey: "enquiryId", as: "enquiry" });

User.hasMany(EnquiryInternalNote, { foreignKey: "staffUserId", as: "enquiryStaffNotes" });
EnquiryInternalNote.belongsTo(User, { foreignKey: "staffUserId", as: "staffUser" });

User.hasMany(EnquiryInternalNote, { foreignKey: "userId", as: "enquiryNotes" });
Product.hasMany(EnquiryInternalNote, { foreignKey: "productId", as: "enquiryNotes" });

EnquiryInternalNote.belongsTo(User, { foreignKey: "userId", as: "user" });
EnquiryInternalNote.belongsTo(Product, { foreignKey: "productId", as: "product" });

User.belongsTo(UserType, { foreignKey: "userTypeId", as: "userType" });
UserType.hasMany(User, { foreignKey: "userTypeId", as: "users" });

Product.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

User.hasMany(Address, { foreignKey: "userId", as: "addresses" });
Address.belongsTo(User, { foreignKey: "userId", as: "user" });


User.hasMany(ShippingAddress, { foreignKey: "userId", as: "shippingAddresses" });
ShippingAddress.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Enquiry, { foreignKey: "userId", as: "enquiries" });
Enquiry.belongsTo(User, { foreignKey: "userId", as: "user" });
Enquiry.belongsTo(User, { foreignKey: "assignedTo", as: "assignedUser" });

User.hasMany(Order, { foreignKey: "userId", as: "orders" });
Order.belongsTo(User, { foreignKey: "userId", as: "user" });

  
User.hasMany(Cart, { foreignKey: "userId", as: "cartItems" });
Cart.belongsTo(User, { foreignKey: "userId", as: "user" });


Product.hasMany(Cart, { foreignKey: "productId", as: "cartItems" });
Cart.belongsTo(Product, { foreignKey: "productId", as: "product" });

Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems" });
OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });


Product.hasMany(OrderItem, { foreignKey: "productId", as: "orderItems" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" });

Order.belongsTo(ShippingAddress, { foreignKey: "shippingAddressId", as: "shippingAddress", allowNull: true });
ShippingAddress.hasMany(Order, { foreignKey: "shippingAddressId", as: "orders" });


Enquiry.belongsTo(Product, { foreignKey: "productId", as: "product" });
Product.hasMany(Enquiry, { foreignKey: "productId", as: "enquiries" });


Enquiry.belongsTo(UserType, { foreignKey: "userType", as: "userTypeData" });
UserType.hasMany(Enquiry, { foreignKey: "userType", as: "enquiries" });

ProductRating.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(ProductRating, { foreignKey: "userId", as: "ratings" });

ProductRating.belongsTo(Product, { foreignKey: "productId", as: "product" });
Product.hasMany(ProductRating, { foreignKey: "productId", as: "ratings" });


const db = {
  UserType,
  User,
  ProductRating,
  Category,
  Product,
  Enquiry,
  Address,
  ShippingAddress,
  Cart,
  Order,
  OrderItem,
  VideoCallEnquiry,
  VideoCallInternalNote,
  EnquiryInternalNote,
  Slider
};

Object.values(db).forEach(model => {
  if (model && model.associate) {
    model.associate(db);
  }
});

console.log("✅ Model associations completed and registered.");

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
  EnquiryInternalNote,
  Slider,
};