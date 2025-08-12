const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addProductRating,
  getProductRatings
} = require('./productController');
const { uploadSingle, uploadMultiple, handleUploadError } = require('../middleware/upload');
const { validateImage } = require('../middleware/imageValidation');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Public routes
router.get('/', getProducts);
router.get('/:id', getProductById);
router.get('/:productId/ratings', getProductRatings);

// Protected routes (Admin/Manager only)
router.post('/', authMiddleware, requireRole(['Admin', 'Manager']), uploadMultiple, handleUploadError, validateImage, createProduct);
router.put('/:id', authMiddleware, requireRole(['Admin', 'Manager']), uploadMultiple, handleUploadError, updateProduct);
router.delete('/:id', authMiddleware, requireRole(['Admin', 'Manager']), deleteProduct);

// User rating routes (authenticated users)
router.post('/:productId/rate', authMiddleware, addProductRating);

module.exports = router;