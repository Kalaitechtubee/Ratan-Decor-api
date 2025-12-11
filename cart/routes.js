// cart/routes.js (updated: consistent middleware, aligned auth)
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
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.auth);

// Main cart routes
router.post('/', auditLogger, addToCart);
router.get('/', auditLogger, getCart);
router.put('/:id', auditLogger, updateCart);
router.delete('/:id', auditLogger, deleteCartItem);

// Additional cart routes
router.get('/count', auditLogger, getCartCount);
router.delete('/', auditLogger, clearCart);

// Error handling
router.use((error, req, res, next) => {
  console.error('Cart route error:', error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors
    });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;