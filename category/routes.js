const express = require('express');
const router = express.Router();
const categoryController = require('./controller');
const { body, param, query, validationResult } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
  }
  next();
};

// Public routes
router.get('/', categoryController.getCategoryTree);
router.get('/subcategories/:parentId', [
  param('parentId').custom(value => value === 'null' || !isNaN(parseInt(value))).withMessage('Parent ID must be an integer or "null"')
], validate, categoryController.getSubCategories);
router.get('/search', [
  query('q').trim().notEmpty().withMessage('Search query is required')
], validate, categoryController.searchCategories);
router.get('/:id', [
  param('id').isInt().withMessage('Category ID must be an integer')
], validate, categoryController.getCategoryById);

// NEW: Name-based routes
router.get('/name/:name', [
  param('name').trim().notEmpty().withMessage('Category name is required')
], validate, categoryController.getCategoryByName);
router.get('/subcategory/name/:name', [
  param('name').trim().notEmpty().withMessage('Subcategory name is required')
], validate, categoryController.getSubCategoryByName);
router.get('/search/name', [
  query('q').trim().notEmpty().withMessage('Search query is required')
], validate, categoryController.searchCategoriesByName);

// Protected routes (Admin/Manager only)
router.post('/subcategory/:parentId', [
  authMiddleware,
  requireRole(['Admin', 'Manager']),
  param('parentId').isInt().withMessage('Parent ID must be an integer'),
  body('name').trim().notEmpty().withMessage('Subcategory name is required'),
  body('brandName').optional().trim()
], validate, categoryController.createSubCategory);
router.post('/', [
  authMiddleware,
  requireRole(['Admin', 'Manager']),
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('brandName').optional().trim()
], validate, categoryController.createCategory);
router.put('/:id', [
  authMiddleware,
  requireRole(['Admin', 'Manager']),
  param('id').isInt().withMessage('Category ID must be an integer'),
  body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
  body('brandName').optional().trim(),
  body('parentId').optional().custom(value => value === null || !isNaN(parseInt(value))).withMessage('Parent ID must be an integer or null')
], validate, categoryController.updateCategory);
router.delete('/:id', [
  authMiddleware,
  requireRole(['Admin', 'Manager']),
  param('id').isInt().withMessage('Category ID must be an integer')
], validate, categoryController.deleteCategory);

module.exports = router;