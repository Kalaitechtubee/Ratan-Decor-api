// routes/product.js (updated: aligned requireSupportAccess for SuperAdmin/Admin/Support, consistent middleware)
const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductByName,
  searchProductsByName,
  getProductById,
  updateProduct,
  updateProductAll,
  deleteProduct,
  addProductRating,
  getProductRatings
} = require('./productController');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');
const { uploadFields, handleUploadError } = require('../middleware/upload');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Public routes
router.get('/', getProducts);
router.get('/name/:name', getProductByName);
router.get('/search', searchProductsByName);
router.get('/:id', getProductById);
router.get('/:productId/ratings', getProductRatings);

// Protected routes (SuperAdmin/Admin/Support)
router.post('/', sanitizeInput, rateLimits.general, uploadFields, handleUploadError, authenticateToken, moduleAccess.requireSupportAccess, auditLogger, createProduct);

router.patch('/:id', sanitizeInput, rateLimits.general, uploadFields, handleUploadError, authenticateToken, moduleAccess.requireSupportAccess, auditLogger, updateProduct);

router.put('/:id', sanitizeInput, rateLimits.general, uploadFields, handleUploadError, authenticateToken, moduleAccess.requireSupportAccess, auditLogger, updateProductAll);

router.delete('/:id', authenticateToken, moduleAccess.requireManagerOrAdmin, auditLogger, deleteProduct);

// Add rating (authenticated user)
router.post('/:productId/rate', sanitizeInput, rateLimits.general, authenticateToken, auditLogger, addProductRating);

// Error handling
router.use(handleUploadError);
router.use((error, req, res, next) => {
  console.error('Product route error:', error);
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