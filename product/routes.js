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

// Routes
router.post('/', uploadSingle, handleUploadError, createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', uploadSingle, handleUploadError, updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;