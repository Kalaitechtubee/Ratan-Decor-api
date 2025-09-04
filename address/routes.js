const express = require('express');
const router = express.Router();
const { createAddress, getAddresses, getAddressById, updateAddress, deleteAddress } = require('./controller');
const { authMiddleware } = require('../middleware');

// Get all addresses for logged-in user
router.get('/', authMiddleware, getAddresses);

// Get single address by ID
router.get('/:id', authMiddleware, getAddressById);

// Create new address
router.post('/', authMiddleware, createAddress);

// Update address
router.put('/:id', authMiddleware, updateAddress);

// Delete address
router.delete('/:id', authMiddleware, deleteAddress);

module.exports = router;
