// productRoutes.js
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
const { uploadSingle, uploadMultiple, handleUploadError, validateImage, authMiddleware, requireRole } = require('../middleware');

// Public routes
router.get('/', getProducts);
router.get('/name/:name', getProductByName);
router.get('/search', searchProductsByName);
router.get('/:id', getProductById);
router.get('/:productId/ratings', getProductRatings);

// Protected routes (Admin/Manager only)
router.post('/', authMiddleware, requireRole(['Admin', 'Manager']), uploadMultiple, handleUploadError, validateImage, createProduct);
router.patch('/:id', authMiddleware, requireRole(['Admin', 'Manager']), uploadMultiple, handleUploadError, updateProduct);
router.put('/:id', authMiddleware, requireRole(['Admin', 'Manager']), uploadMultiple, handleUploadError, validateImage, updateProductAll);
router.delete('/:id', authMiddleware, requireRole(['Admin', 'Manager']), deleteProduct);

// User rating routes (authenticated users)
router.post('/:productId/rate', authMiddleware, addProductRating);

module.exports = router;