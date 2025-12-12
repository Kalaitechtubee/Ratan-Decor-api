// routes/shipping-address.js (clean version: removed all role/ownership checks)
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

const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.auth);

// Routes (authenticated only — no ownership checks)
router.post('/', auditLogger, createShippingAddress);

router.get('/', auditLogger, getShippingAddresses);

router.get('/:id', auditLogger, getShippingAddressById);

router.put('/:id', auditLogger, updateShippingAddress);

router.delete('/:id', auditLogger, deleteShippingAddress);

router.patch('/:id/set-default', auditLogger, setDefaultShippingAddress);

module.exports = router;
