// models/index.js
const Sequelize = require('sequelize');
const sequelize = require('../config/database');

// Define models
const User = sequelize.define('User', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
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
    type: Sequelize.ENUM('General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support'),
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
  // Add multiple images support
  images: {
    type: Sequelize.JSON, // Store multiple image filenames as JSON array
    allowNull: true,
    defaultValue: [],
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
  categoryId: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  productUsageTypeId: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  // Add GST and colors fields
  colors: {
    type: Sequelize.JSON, // Store colors as a JSON array, e.g., ["Red", "Blue", "Green"]
    allowNull: true,
    defaultValue: [],
  },
  gst: {
    type: Sequelize.DECIMAL(5, 2), // Store GST percentage, e.g., 18.00 for 18%
    allowNull: true,
    defaultValue: 0.00,
  },
  // Add rating fields
  averageRating: {
    type: Sequelize.DECIMAL(3, 2), // Store average rating (0.00 to 5.00)
    allowNull: true,
    defaultValue: 0.00,
  },
  totalRatings: {
    type: Sequelize.INTEGER, // Store total number of ratings
    allowNull: true,
    defaultValue: 0,
  },
}, {
  tableName: 'products',
  timestamps: true,
});
// const Product = sequelize.define('Product', {
//   name: {
//     type: Sequelize.STRING,
//     allowNull: false,
//   },
//   description: {
//     type: Sequelize.TEXT,
//   },
//   image: {
//     type: Sequelize.STRING,
//   },
//   specifications: {
//     type: Sequelize.JSON,
//   },
//   visibleTo: {
//     type: Sequelize.JSON,
//     defaultValue: ['Residential', 'Commercial', 'Modular Kitchen', 'Others'],
//   },
//   isActive: {
//     type: Sequelize.BOOLEAN,
//     defaultValue: true,
//   },
//   generalPrice: {
//     type: Sequelize.DECIMAL(10, 2),
//     allowNull: false,
//   },
//   architectPrice: {
//     type: Sequelize.DECIMAL(10, 2),
//     allowNull: false,
//   },
//   dealerPrice: {
//     type: Sequelize.DECIMAL(10, 2),
//     allowNull: false,
//   },
//   categoryId: {
//     type: Sequelize.INTEGER,
//     allowNull: true,
//   },
//   productUsageTypeId: {
//     type: Sequelize.INTEGER,
//     allowNull: true,
//   },
//   colors: {
//     type: Sequelize.JSON, // Store colors as a JSON array, e.g., ["Red", "Blue", "Green"]
//     allowNull: true,
//     defaultValue: [],
//   },
//   gst: {
//     type: Sequelize.DECIMAL(5, 2), // Store GST percentage, e.g., 18.00 for 18%
//     allowNull: true,
//     defaultValue: 0.00,
//   },
// }, {
//   tableName: 'products',
//   timestamps: true,
// });

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

// FIXED CART MODEL - Added missing foreign keys
const Cart = sequelize.define('Cart', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  productId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },



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

const ProductUsageType = sequelize.define('ProductUsageType', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  description: {
    type: Sequelize.TEXT,
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'product_usage_types',
  timestamps: true,
});

const ShippingAddress = sequelize.define('ShippingAddress', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  phone: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  address: {
    type: Sequelize.TEXT,
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
  pincode: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  isDefault: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  addressType: {
    type: Sequelize.ENUM('Home', 'Office', 'Other'),
    defaultValue: 'Home',
  },
}, {
  tableName: 'shipping_addresses',
  timestamps: true,
});

const ProductRating = sequelize.define('ProductRating', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  productId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  rating: {
    type: Sequelize.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  review: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'product_ratings',
  timestamps: true,
});

// CORRECTED ASSOCIATIONS
console.log('🔗 Setting up model associations...');

// Category associations
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

// CRITICAL CART ASSOCIATIONS - FIXED
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

// Add ProductRating to associations
Product.hasMany(ProductRating, { foreignKey: 'productId', as: 'Ratings' });
ProductRating.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });

User.hasMany(ProductRating, { foreignKey: 'userId', as: 'ProductRatings' });
ProductRating.belongsTo(User, { foreignKey: 'userId', as: 'User' });

console.log('✅ Model associations completed');

// Export models and Sequelize instance
const db = {
  User,
  Category,
  Product,
  ProductUsageType,
  Enquiry,
  Address,
  ShippingAddress,
  Cart,
  Order,
  OrderItem,
  ProductRating, // Add this
  sequelize,
  Sequelize,
};

module.exports = db;