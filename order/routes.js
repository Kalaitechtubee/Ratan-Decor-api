// routes/order.js (updated: proper module access control aligned with permissions table)
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
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.general);

// GET /api/orders/addresses - Get available shipping addresses
// Orders module: SuperAdmin, Admin, Sales
router.get('/addresses', moduleAccess.requireOrdersAccess, auditLogger, getAvailableAddresses);

// POST /api/orders - Create new order
// Any authenticated user can create orders (customers + staff)
router.post('/', auditLogger, createOrder);

// GET /api/orders - Get all orders (with role-based filtering in controller)
// Orders module: SuperAdmin, Admin, Sales
router.get('/', moduleAccess.requireOrdersAccess, auditLogger, getOrders);

// GET /api/orders/stats - Get order statistics
// Orders module: SuperAdmin, Admin, Sales
router.get('/stats', moduleAccess.requireOrdersAccess, auditLogger, getOrderStats);

// GET /api/orders/:id - Get order by ID (with ownership check in controller)
// Orders module: SuperAdmin, Admin, Sales (+ own orders for customers)
router.get('/:id', moduleAccess.requireOrdersAccess, auditLogger, getOrderById);

// PUT /api/orders/:id/cancel - Cancel order (with ownership check in controller)
// Orders module: SuperAdmin, Admin, Sales (+ own orders for customers)
router.put('/:id/cancel', moduleAccess.requireOrdersAccess, auditLogger, cancelOrder);

// PUT /api/orders/:id - Update order (with ownership check in controller)
// Orders module: SuperAdmin, Admin, Sales (+ own orders for customers)
router.put('/:id', moduleAccess.requireOrdersAccess, auditLogger, updateOrder);

// DELETE /api/orders/:id - Delete order
// Orders module: SuperAdmin, Admin, Sales
router.delete('/:id', moduleAccess.requireOrdersAccess, auditLogger, deleteOrder);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Order route error:', {
    message: error.message,
    userId: req.user?.id,
    role: req.user?.role,
    path: req.path
  });

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Database validation error',
      errors: error.errors.map(e => e.message)
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;