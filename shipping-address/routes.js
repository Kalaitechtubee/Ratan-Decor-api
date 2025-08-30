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
const { authMiddleware } = require('../middleware');

// All routes require authentication
router.use(authMiddleware);

// CRUD operations
router.post('/', createShippingAddress);
router.get('/', getShippingAddresses);
router.get('/:id', getShippingAddressById);
router.put('/:id', updateShippingAddress);
router.delete('/:id', deleteShippingAddress);

// Set default address
router.patch('/:id/default', setDefaultShippingAddress);

module.exports = router;