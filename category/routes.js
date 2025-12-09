// routes/category.js - Updated without express-validator
const express = require('express');
const router = express.Router();
const categoryController = require('./controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { uploadCategoryImage, handleUploadError } = require('../middleware/upload');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(sanitizeInput); // Global sanitization
router.use(rateLimits.general); // Global rate limiting

// ===============================
// Public Routes
// ===============================
// Get all categories as a tree structure
router.get('/', auditLogger, categoryController.getCategoryTree);

// Search categories by name
router.get(
  '/search',
  auditLogger,
  categoryController.searchCategories
);

// Get subcategories for a specific parent category
router.get(
  '/subcategories/:parentId',
  auditLogger,
  categoryController.getSubCategories
);

// Get a specific category by ID
router.get(
  '/:id',
  auditLogger,
  categoryController.getCategoryById
);

// ===============================
// Protected Routes (Admin/Manager/SuperAdmin only)
// ===============================
// Create a new main category (WITH IMAGE UPLOAD)
router.post(
  '/',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  auditLogger,
  uploadCategoryImage, // Parse multipart FIRST
  handleUploadError, // Handle upload errors IMMEDIATELY
  categoryController.createCategory
);

// Create a new subcategory (NO IMAGE UPLOAD - middleware not applied)
router.post(
  '/subcategory/:parentId',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  auditLogger,
  categoryController.createSubCategory
);

// Update a category (WITH IMAGE UPLOAD - but controller checks if main category)
router.put(
  '/:id',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  auditLogger,
  uploadCategoryImage, // Parse multipart FIRST
  handleUploadError, // Handle upload errors
  categoryController.updateCategory
);

// Check category deletion impact
router.get(
  '/:id/deletion-check',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  auditLogger,
  categoryController.checkCategoryDeletion
);

// Force delete category with product handling options
router.delete(
  '/:id/force',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  auditLogger,
  categoryController.forceDeleteCategory
);

// Delete a category and all its subcategories
router.delete(
  '/:id',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  auditLogger,
  categoryController.deleteCategory
);

// ===============================
// Error handling middleware
// ===============================
// FIXED: Upload error handler before general errors
router.use(handleUploadError);

router.use((error, req, res, next) => {
  console.error('Category route error:', error);
 
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