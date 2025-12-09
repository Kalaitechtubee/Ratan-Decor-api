// routes/shipping-address.js - Updated without express-validator
const express = require('express');
const router = express.Router();
const {
  createShippingAddress,
  getShippingAddresses,
  getShippingAddressById,
  updateShippingAddress,
  deleteShippingAddress,
  setDefaultShippingAddress
} = require('./controller');
const { authMiddleware, requireOwnDataOrStaff } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(authMiddleware); // All routes require authentication
router.use(sanitizeInput); // Global sanitization
router.use(rateLimits.general); // Global rate limiting

// CRUD operations (authenticated user - SuperAdmin/Admin can access via staff bypass if needed)
// Create shipping address
router.post('/',
  auditLogger,
  createShippingAddress
);

// Get shipping addresses (own or staff - SuperAdmin/Admin bypass)
router.get('/',
  auditLogger,
  getShippingAddresses
);

// Get specific shipping address (own or staff - SuperAdmin/Admin bypass)
router.get('/:id',
  requireOwnDataOrStaff, // Ensures ownership or staff access
  auditLogger,
  getShippingAddressById
);

// Update shipping address (own or staff - SuperAdmin/Admin bypass)
router.put('/:id',
  requireOwnDataOrStaff,
  auditLogger,
  updateShippingAddress
);

// Delete shipping address (own or staff - SuperAdmin/Admin bypass)
router.delete('/:id',
  requireOwnDataOrStaff,
  auditLogger,
  deleteShippingAddress
);

// Set default address (own or staff - SuperAdmin/Admin bypass)
router.patch('/:id/default',
  requireOwnDataOrStaff,
  auditLogger,
  setDefaultShippingAddress
);

// Global error handling
router.use((error, req, res, next) => {
  console.error('Shipping Address route error:', error);
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
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;