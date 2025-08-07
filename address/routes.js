// address/routes.js
const express = require('express');
const router = express.Router();
const { createAddress, getAddresses, updateAddress, deleteAddress } = require('./controller');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, createAddress);
router.get('/', authenticate, getAddresses);
router.put('/:id', authenticate, updateAddress);
router.delete('/:id', authenticate, deleteAddress);

module.exports = router;