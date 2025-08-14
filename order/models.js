// Update your models/index.js Order and OrderItem definitions with these:

const Order = sequelize.define('Order', {
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
    allowNull: true,
  },
  // Enhanced pricing fields
  total: {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: false,
  },
  subtotal: {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: true,
  },
  gstAmount: {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  platformCommission: {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  // Additional order fields
  shippingAddressId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: 'shipping_addresses',
      key: 'id'
    }
  },
  notes: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  orderDate: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  expectedDeliveryDate: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  // Shipping tracking
  trackingNumber: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  shippingProvider: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  // Cancellation fields
  cancellationReason: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  cancelledAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
}, {
  tableName: 'orders',
  timestamps: true, // This will add createdAt and updatedAt
});

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: 'orders',
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
  },
  // Enhanced pricing fields for order items
  price: {
    type: Sequelize.DECIMAL(10, 2),
    allowNull: false, // Unit price at time of order
  },
  subtotal: {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: true, // price * quantity
  },
  gstRate: {
    type: Sequelize.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00, // GST percentage at time of order
  },
  gstAmount: {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0.00, // Calculated GST amount
  },
  total: {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: true, // subtotal + gstAmount
  },
  // Product snapshot at time of order
  productSnapshot: {
    type: Sequelize.JSON,
    allowNull: true, // Store product details as they were when ordered
  },
}, {
  tableName: 'order_items',
  timestamps: true,
});

// Add these associations to your models/index.js file:

// Order associations
User.hasMany(Order, { foreignKey: 'userId', as: 'Orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'User' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'OrderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'Order' });

Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'OrderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'Product' });

// Shipping address association
Order.belongsTo(ShippingAddress, { foreignKey: 'shippingAddressId', as: 'ShippingAddress' });
ShippingAddress.hasMany(Order, { foreignKey: 'shippingAddressId', as: 'Orders' });