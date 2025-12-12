const express = require('express');
const router = express.Router();
const { createAddress, getAddresses, getAddressById, updateAddress, deleteAddress } = require('./controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, getAddresses);
router.get('/:id', authenticateToken, getAddressById);
router.post('/', authenticateToken, createAddress);
router.put('/:id', authenticateToken, updateAddress);
router.delete('/:id', authenticateToken, deleteAddress);

module.exports = router;