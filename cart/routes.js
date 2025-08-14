// cart/routes.js
const express = require('express');
const router = express.Router();
const { 
  addToCart, 
  getCart, 
  updateCart, 
  deleteCartItem, 
  getCartCount,
  clearCart 
} = require('./controller');
const { authMiddleware } = require('../middleware/auth');

// Main cart routes
router.post('/', authMiddleware, addToCart);           // Add item to cart
router.get('/', authMiddleware, getCart);              // Get all cart items with full details
router.put('/:id', authMiddleware, updateCart);        // Update cart item quantity
router.delete('/:id', authMiddleware, deleteCartItem); // Delete specific cart item

// Additional cart routes
router.get('/count', authMiddleware, getCartCount);    // Get cart count for badges
router.delete('/', authMiddleware, clearCart);         // Clear entire cart

module.exports = router;