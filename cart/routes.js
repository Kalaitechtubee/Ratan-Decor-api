// cart/routes.js
const express = require('express');
const router = express.Router();
const { addToCart, getCart, updateCart, deleteCartItem } = require('./controller');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, addToCart);
router.get('/', authenticate, getCart);
router.put('/:id', authenticate, updateCart);
router.delete('/:id', authenticate, deleteCartItem);

module.exports = router;