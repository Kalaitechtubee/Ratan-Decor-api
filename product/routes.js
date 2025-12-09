// routes/product.js - Updated without express-validator
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
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { uploadFields, handleUploadError } = require('../middleware/upload');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Public routes (no auth needed)
router.get('/', getProducts);
router.get('/name/:name', getProductByName);
router.get('/search', searchProductsByName);
router.get('/:id', getProductById);
router.get('/:productId/ratings', getProductRatings);

// Protected routes (Support/Staff for create/update - SuperAdmin/Admin included via requireSupportAccess)
router.post('/',
  sanitizeInput,
  rateLimits.general,
  uploadFields,
  handleUploadError,
  authenticateToken,
  moduleAccess.requireSupportAccess, // SuperAdmin/Admin included
  auditLogger,
  createProduct
);

router.patch('/:id',
  sanitizeInput,
  rateLimits.general,
  uploadFields,
  handleUploadError,
  authenticateToken,
  moduleAccess.requireSupportAccess, // SuperAdmin/Admin included
  auditLogger,
  updateProduct
);

router.put('/:id',
  sanitizeInput,
  rateLimits.general,
  uploadFields,
  handleUploadError,
  authenticateToken,
  moduleAccess.requireSupportAccess, // SuperAdmin/Admin included
  auditLogger,
  updateProductAll
);

router.delete('/:id',
  sanitizeInput,
  rateLimits.general,
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin explicit
  auditLogger,
  deleteProduct
);

// Add rating (authenticated user)
router.post('/:productId/rate',
  sanitizeInput,
  rateLimits.general,
  authenticateToken,
  auditLogger,
  addProductRating
);

// Error handling for uploads
router.use(handleUploadError);

module.exports = router;