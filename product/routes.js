// routes/product.js
const express = require('express');
const router = express.Router();
const {
  createProduct, getProducts, getProductByName,
  searchProductsByName, getProductById, updateProduct,
  updateProductAll, deleteProduct, addProductRating, getProductRatings
} = require('./productController');
const { authenticateToken } = require('../middleware/auth');
const { uploadFields, handleUploadError } = require('../middleware/upload');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

router.get('/', getProducts);
router.get('/name/:name', getProductByName);
router.get('/search', searchProductsByName);
router.get('/:id', getProductById);
router.get('/:productId/ratings', getProductRatings);

router.post('/', authenticateToken, sanitizeInput, rateLimits.general, uploadFields, handleUploadError, auditLogger, createProduct);
router.patch('/:id', authenticateToken, sanitizeInput, rateLimits.general, uploadFields, handleUploadError, auditLogger, updateProduct);
router.put('/:id', authenticateToken, sanitizeInput, rateLimits.general, uploadFields, handleUploadError, auditLogger, updateProductAll);
router.delete('/:id', authenticateToken, auditLogger, deleteProduct);
router.post('/:productId/rate', authenticateToken, sanitizeInput, rateLimits.general, auditLogger, addProductRating);

router.use(handleUploadError);
router.use((error, req, res, next) => {
  console.error('Product route error:', error);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = router;