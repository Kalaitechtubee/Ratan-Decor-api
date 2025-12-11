// routes/user.js (updated: proper module access control aligned with permissions table)
const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getAllStaffUsers,
  getStaffUserById,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserOrderHistory,
  getFullOrderHistory
} = require('./controller');

const {
  authenticateToken,
  moduleAccess
} = require('../middleware/auth');

const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.general);

// POST /api/users - Create new user
// Staff Management: SuperAdmin, Admin only
router.post('/', moduleAccess.requireStaffManagementAccess, auditLogger, createUser);

// GET /api/users - Get all users (customers)
// Customers module: SuperAdmin, Admin, Sales
// Customers module: SuperAdmin, Admin, Sales
router.get('/', moduleAccess.requireCustomersAccess, auditLogger, getAllUsers);

// GET /api/users/staff - Get all staff users
// Staff Management: SuperAdmin, Admin only
router.get('/staff', moduleAccess.requireStaffManagementAccess, auditLogger, getAllStaffUsers);

// GET /api/users/:id - Get user by ID
// Customers module: SuperAdmin, Admin, Sales (with ownership check in controller)
router.get('/:id', moduleAccess.requireCustomersAccess, auditLogger, getUserById);

// GET /api/users/staff/:id - Get staff user by ID
// Staff Management: SuperAdmin, Admin only
router.get('/staff/:id', moduleAccess.requireStaffManagementAccess, auditLogger, getStaffUserById);

// PUT /api/users/:id - Update user
// Customers module: SuperAdmin, Admin, Sales (with ownership check in controller)
router.put('/:id', moduleAccess.requireCustomersAccess, auditLogger, updateUser);

// DELETE /api/users/:id - Delete user
// Staff Management: SuperAdmin, Admin only (for staff), or Customers module for customers
router.delete('/:id', moduleAccess.requireStaffManagementAccess, auditLogger, deleteUser);

// GET /api/users/:id/orders - Get user order history
// Orders module: SuperAdmin, Admin, Sales (with ownership check in controller)
router.get('/:id/orders', moduleAccess.requireOrdersAccess, auditLogger, getUserOrderHistory);

// GET /api/users/orders/full - Get full order history across all users
// Orders module: SuperAdmin, Admin, Sales
router.get('/orders/full', moduleAccess.requireOrdersAccess, auditLogger, getFullOrderHistory);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('User route error:', {
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

  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'A user with this email or mobile already exists'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;