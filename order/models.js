// Enhanced Order Model with Address Support
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Processing', 'Shipped', 'Completed', 'Cancelled'),
    defaultValue: 'Pending',
  },
  paymentMethod: {
    type: DataTypes.ENUM('Gateway', 'UPI', 'BankTransfer'),
    allowNull: false,
  },
  paymentStatus: {
    type: DataTypes.ENUM('Awaiting', 'Approved', 'Rejected'),
    defaultValue: 'Awaiting',
  },
  paymentProof: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Enhanced pricing fields
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  gstAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  platformCommission: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  
  // === ENHANCED ADDRESS FIELDS ===
  // Traditional shipping address reference (optional)
  shippingAddressId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'shipping_addresses',
      key: 'id'
    }
  },
  // New address type field
  deliveryAddressType: {
    type: DataTypes.ENUM('default', 'shipping'),
    allowNull: true,
    defaultValue: 'default',
    comment: 'Type of address used: default (from user profile) or shipping (from shipping_addresses)'
  },
  // Store complete address data as JSON for historical purposes
  deliveryAddressData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Complete address data stored at time of order creation'
  },
  
  // Additional order fields
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Add this field back to the Order model if you want indexes:
  orderDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  expectedDeliveryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Shipping tracking
  trackingNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  shippingProvider: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Cancellation fields
  cancellationReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'orders',
  timestamps: false, // This will add createdAt and updatedAt
  // Remove problematic indexes for now
  // indexes: [
  //   {
  //     fields: ['userId', 'status']
  //   },
  //   {
  //     fields: ['orderDate']
  //   },
  //   {
  //     fields: ['paymentStatus']
  //   },
  //   {
  //     fields: ['deliveryAddressType']
  //   }
  // ]
});

// Enhanced OrderItem model
const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'orders',
      key: 'id'
    }
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // Enhanced pricing fields for order items
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false, // Unit price at time of order
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true, // price * quantity
  },
  gstRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00, // GST percentage at time of order
  },
  gstAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0.00, // Calculated GST amount
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true, // subtotal + gstAmount
  },
  // Product snapshot at time of order
  productSnapshot: {
    type: DataTypes.JSON,
    allowNull: true, // Store product details as they were when ordered
  },
}, {
  tableName: 'order_items',
  timestamps: true,
});

// Export both models
module.exports = {
  Order,
  OrderItem
};