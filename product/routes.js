const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct
} = require('./productController');
const {
  allowedUserTypes,
  isValidUserType,
  validateVisibleTo
} = require('../models/productUsageType');

module.exports = { allowedUserTypes, isValidUserType, validateVisibleTo };

// Routes
router.post('/', createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;