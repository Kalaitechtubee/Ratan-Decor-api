// routes/order.js - Updated without role-based access but with authentication
const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  deleteOrder,
  getOrderStats,
  getAvailableAddresses
} = require('./controller');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.general);

// Get available addresses (authenticated user only)
router.get('/addresses',
  auditLogger,
  getAvailableAddresses
);

// Create order (authenticated user only)
router.post('/',
  auditLogger,
  createOrder
);

// Get orders (authenticated user sees own orders)
router.get('/', auditLogger, getOrders);

// Order stats (authenticated user sees own stats)
router.get('/stats',
  auditLogger,
  getOrderStats
);

// Get order by ID (own order only)
router.get('/:id',
  auditLogger,
  getOrderById
);

// Cancel order (own order only)
router.put('/:id/cancel',
  auditLogger,
  cancelOrder
);

// Update order (own order only)
router.put('/:id',
  auditLogger,
  updateOrder
);

// Delete order (own order only)
router.delete('/:id',
  auditLogger,
  deleteOrder
);

module.exports = router;