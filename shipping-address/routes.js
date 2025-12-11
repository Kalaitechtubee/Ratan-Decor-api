// routes/shipping-address.js (updated: consistent middleware, aligned requireOwnDataOrStaff)
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

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.auth);

router.post('/', auditLogger, createShippingAddress);

router.get('/', auditLogger, getShippingAddresses);

router.get('/:id', auditLogger, requireOwnDataOrStaff, getShippingAddressById);

router.put('/:id', auditLogger, requireOwnDataOrStaff, updateShippingAddress);

router.delete('/:id', auditLogger, requireOwnDataOrStaff, deleteShippingAddress);

router.patch('/:id/set-default', auditLogger, requireOwnDataOrStaff, setDefaultShippingAddress);

module.exports = router;