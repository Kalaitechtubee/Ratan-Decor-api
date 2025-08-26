// address/routes.js
const express = require('express');
const router = express.Router();
const { createAddress, getAddresses, updateAddress, deleteAddress } = require('./controller');
const { authMiddleware } = require('../middleware');

router.post('/', authMiddleware, createAddress);
router.get('/', authMiddleware, getAddresses);
router.put('/:id', authMiddleware, updateAddress);
router.delete('/:id', authMiddleware, deleteAddress);

module.exports = router;