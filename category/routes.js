// routes/category.js
const express = require('express');
const router = express.Router();
const categoryController = require('./controller');
const { authenticateToken } = require('../middleware/auth');
const { uploadCategoryImage, handleUploadError } = require('../middleware/upload');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

router.use(sanitizeInput);
router.use(rateLimits.general);

router.get('/', auditLogger, categoryController.getCategoryTree);
router.get('/search', auditLogger, categoryController.searchCategories);
router.get('/subcategories/:parentId', auditLogger, categoryController.getSubCategories);
router.get('/:id', auditLogger, categoryController.getCategoryById);

router.post('/', authenticateToken, auditLogger, uploadCategoryImage, handleUploadError, categoryController.createCategory);
router.post('/subcategory/:parentId', authenticateToken, auditLogger, categoryController.createSubCategory);
router.put('/:id', authenticateToken, auditLogger, uploadCategoryImage, handleUploadError, categoryController.updateCategory);
router.get('/:id/deletion-check', authenticateToken, auditLogger, categoryController.checkCategoryDeletion);
router.delete('/:id/force', authenticateToken, auditLogger, categoryController.forceDeleteCategory);
router.delete('/:id', authenticateToken, auditLogger, categoryController.deleteCategory);

router.use(handleUploadError);
router.use((error, req, res, next) => {
  console.error('Category route error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;