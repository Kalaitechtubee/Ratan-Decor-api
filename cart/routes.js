// cart/routes.js
const express = require('express');
const router = express.Router();
const { addToCart, getCart, updateCart, deleteCartItem } = require('./controller');
const { authMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, addToCart);
router.get('/', authMiddleware, getCart);
router.put('/:id', authMiddleware, updateCart);
router.delete('/:id', authMiddleware, deleteCartItem);

module.exports = router;