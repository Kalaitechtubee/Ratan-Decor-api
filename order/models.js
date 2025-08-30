// models/order.js
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
    type: DataTypes.ENUM('Gateway', 'UPI', 'BankTransfer', 'COD'),
    allowNull: false,
  },
  paymentStatus: {
    type: DataTypes.ENUM('Awaiting', 'Approved', 'Rejected'),
    defaultValue: 'Awaiting',
  },
  total: {
    type: DataTypes.DECIMAL(10, 2), // Match DB schema
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
  shippingAddressId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'shipping_addresses',
      key: 'id'
    }
  },
  deliveryAddressType: {
    type: DataTypes.ENUM('default', 'shipping'), // Match DB schema (no 'new')
    allowNull: true,
    defaultValue: 'default',
    comment: 'Type of address used: default (from user profile), shipping (from shipping_addresses)'
  },
  deliveryAddressData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Complete address data stored at time of order creation'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  orderDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  expectedDeliveryDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Removed shippingProvider - not in DB schema
  // Removed cancellationReason - not in DB schema
  // Removed cancelledAt - not in DB schema
}, {
  tableName: 'orders',
  timestamps: false, // No createdAt/updatedAt in DB
});

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
  price: {
    type: DataTypes.DECIMAL(10, 2),
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
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
}, {
  tableName: 'order_items',
  timestamps: true, // Has createdAt/updatedAt in DB
});

module.exports = {
  Order,
  OrderItem
};