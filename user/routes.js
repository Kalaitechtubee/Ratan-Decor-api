// routes/user.js (ALL role-based access removed – auth-only)
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

const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares – only authentication + security
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.general);

// Create new user (any authenticated user)
router.post('/', auditLogger, createUser);

// Get all users (customers + staff)
router.get('/', auditLogger, getAllUsers);

// Get all staff users (all authenticated users)
router.get('/staff', auditLogger, getAllStaffUsers);

// Get user by ID
router.get('/:id', auditLogger, getUserById);

// Get staff user by ID (all authenticated users)
router.get('/staff/:id', auditLogger, getStaffUserById);

// Update any user
router.put('/:id', auditLogger, updateUser);

// Delete any user
router.delete('/:id', auditLogger, deleteUser);

// Get order history of any user
router.get('/:id/orders', auditLogger, getUserOrderHistory);

// Get full order history of all users
router.get('/orders/full', auditLogger, getFullOrderHistory);

// Error handling
router.use((error, req, res, next) => {
  console.error('User route error:', {
    message: error.message,
    userId: req.user?.id,
    path: req.path
  });

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors || error.message
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
      errors: error.errors?.map(e => e.message) || []
    });
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'A user with this email or mobile already exists'
    });
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

module.exports = router;