// routes/shipping-address.js
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
const { authenticateToken, requireOwnDataOrStaff } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(authenticateToken); // All routes require authentication
router.use(sanitizeInput); // Global sanitization
router.use(rateLimits.auth); // Global rate limiting

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

// Get single shipping address
router.get('/:id',
  auditLogger,
  requireOwnDataOrStaff,
  getShippingAddressById
);

// Update shipping address
router.put('/:id',
  auditLogger,
  requireOwnDataOrStaff,
  updateShippingAddress
);

// Delete shipping address
router.delete('/:id',
  auditLogger,
  requireOwnDataOrStaff,
  deleteShippingAddress
);

// Set default shipping address
router.patch('/:id/set-default',
  auditLogger,
  requireOwnDataOrStaff,
  setDefaultShippingAddress
);

module.exports = router;