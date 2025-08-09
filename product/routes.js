const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct
} = require('./productController');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const { validateImage } = require('../middleware/imageValidation');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Public routes
router.get('/', getProducts);
router.get('/:id', getProductById);

// Protected routes (Admin/Manager only)
router.post('/', authMiddleware, requireRole(['Admin', 'Manager']), uploadSingle, handleUploadError, validateImage, createProduct);
router.put('/:id', authMiddleware, requireRole(['Admin', 'Manager']), uploadSingle, handleUploadError, updateProduct);
router.delete('/:id', authMiddleware, requireRole(['Admin', 'Manager']), deleteProduct);

module.exports = router;