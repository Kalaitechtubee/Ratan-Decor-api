// routes/category.js (updated: consistent middleware, aligned requireManagerOrAdmin)
const express = require('express');
const router = express.Router();
const categoryController = require('./controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { uploadCategoryImage, handleUploadError } = require('../middleware/upload');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(sanitizeInput);
router.use(rateLimits.general);

// Public Routes
router.get('/', auditLogger, categoryController.getCategoryTree);
router.get('/search', auditLogger, categoryController.searchCategories);
router.get('/subcategories/:parentId', auditLogger, categoryController.getSubCategories);
router.get('/:id', auditLogger, categoryController.getCategoryById);

// Protected Routes (SuperAdmin/Admin only via requireManagerOrAdmin)
router.post('/', authenticateToken, moduleAccess.requireManagerOrAdmin, auditLogger, uploadCategoryImage, handleUploadError, categoryController.createCategory);
router.post('/subcategory/:parentId', authenticateToken, moduleAccess.requireManagerOrAdmin, auditLogger, categoryController.createSubCategory);
router.put('/:id', authenticateToken, moduleAccess.requireManagerOrAdmin, auditLogger, uploadCategoryImage, handleUploadError, categoryController.updateCategory);
router.get('/:id/deletion-check', authenticateToken, moduleAccess.requireManagerOrAdmin, auditLogger, categoryController.checkCategoryDeletion);
router.delete('/:id/force', authenticateToken, moduleAccess.requireManagerOrAdmin, auditLogger, categoryController.forceDeleteCategory);
router.delete('/:id', authenticateToken, moduleAccess.requireManagerOrAdmin, auditLogger, categoryController.deleteCategory);

// Error handling
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