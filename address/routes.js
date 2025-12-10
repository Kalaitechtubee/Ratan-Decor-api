// address/routes.js
const express = require('express');
const router = express.Router();
const { createAddress, getAddresses, getAddressById, updateAddress, deleteAddress } = require('./controller');
const { authenticateToken } = require('../middleware/auth');

// Get all addresses for logged-in user
router.get('/', authenticateToken, getAddresses);

// Get single address by ID
router.get('/:id', authenticateToken, getAddressById);

// Create new address
router.post('/', authenticateToken, createAddress);

// Update address
router.put('/:id', authenticateToken, updateAddress);

// Delete address
router.delete('/:id', authenticateToken, deleteAddress);

module.exports = router;