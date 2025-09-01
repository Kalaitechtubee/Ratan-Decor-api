// routes/products.js - Product Management (Support focused)
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

// Public routes (no auth needed)
router.get('/', getProducts);
router.get('/name/:name', getProductByName);
router.get('/search', searchProductsByName);
router.get('/:id', getProductById);
router.get('/:productId/ratings', getProductRatings);

// Product management (Admin, Manager, Support only)
router.post('/', 
  authenticateToken, 
  moduleAccess.requireSupportAccess, 
  createProduct
);

router.patch('/:id', 
  authenticateToken, 
  moduleAccess.requireSupportAccess, 
  updateProduct
);

router.put('/:id', 
  authenticateToken, 
  moduleAccess.requireSupportAccess, 
  updateProductAll
);

router.delete('/:id', 
  authenticateToken, 
  moduleAccess.requireManagerOrAdmin, // Only Admin/Manager can delete
  deleteProduct
);

// User rating (any authenticated user)
router.post('/:productId/rate', 
  authenticateToken, 
  addProductRating
);

module.exports = router;
