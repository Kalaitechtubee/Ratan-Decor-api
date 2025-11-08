// routes/products.js - Fixed Product Management Routes
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

// Public routes (no auth needed)
router.get('/', getProducts);
router.get('/name/:name', getProductByName);
router.get('/search', searchProductsByName);
router.get('/:id', getProductById);
router.get('/:productId/ratings', getProductRatings);

// Product management (Admin, Manager, Support only)
// FIXED: Added upload middleware BEFORE authentication
router.post('/',
  uploadFields,           // Parse multipart data FIRST
  handleUploadError,      // Handle upload errors
  authenticateToken,      // Then authenticate
  moduleAccess.requireSupportAccess,  // Then authorize
  createProduct           // Finally create product
);

router.patch('/:id',
  uploadFields,           // Parse multipart data FIRST
  handleUploadError,      // Handle upload errors
  authenticateToken,      // Then authenticate
  moduleAccess.requireSupportAccess,  // Then authorize
  updateProduct           // Finally update product
);

router.put('/:id',
  uploadFields,           // Parse multipart data FIRST
  handleUploadError,      // Handle upload errors
  authenticateToken,      // Then authenticate
  moduleAccess.requireSupportAccess,  // Then authorize
  updateProductAll        // Finally update product (harmonized with updateProduct)
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
