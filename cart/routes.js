// cart/routes.js - Updated without express-validator
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
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(authMiddleware); // All routes require authentication
router.use(sanitizeInput); // Global sanitization
router.use(rateLimits.general); // Global rate limiting

// Main cart routes
router.post('/', 
  auditLogger,
  addToCart  // Add item to cart
);

router.get('/', 
  auditLogger,
  getCart  // Get all cart items with full details
);

router.put('/:id', 
  auditLogger,
  updateCart  // Update cart item quantity
);

router.delete('/:id', 
  auditLogger,
  deleteCartItem  // Delete specific cart item
);

// Additional cart routes
router.get('/count', 
  auditLogger,
  getCartCount  // Get cart count for badges
);

router.delete('/', 
  auditLogger,
  clearCart  // Clear entire cart
);

// Global error handling
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