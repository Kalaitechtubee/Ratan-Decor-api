// routes/category.js - FIXED Category Management Routes
const express = require('express');
const router = express.Router();
const categoryController = require('./controller');
const { body, param, query, validationResult } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware/auth');

// ===============================
// Validation middleware
// ===============================
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// ===============================
// Public Routes
// ===============================

// Get all categories as a tree structure
router.get('/', categoryController.getCategoryTree);

// Search categories by name
router.get(
  '/search',
  [query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters long')],
  validate,
  categoryController.searchCategories
);

// FIXED: Get subcategories for a specific parent category (handles 'null' properly)
router.get(
  '/subcategories/:parentId',
  [
    param('parentId').custom((value) => {
      // Allow 'null', 'undefined', empty string, or valid integers
      if (value === 'null' || value === 'undefined' || value === '') {
        return true;
      }
      if (!Number.isInteger(parseInt(value)) || parseInt(value) <= 0) {
        throw new Error('Parent ID must be a positive integer or "null"');
      }
      return true;
    })
  ],
  validate,
  categoryController.getSubCategories
);

// Get a specific category by ID
router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Category ID must be a positive integer')],
  validate,
  categoryController.getCategoryById
);

// ===============================
// Protected Routes (Admin/Manager only)
// ===============================

// Create a new main category
router.post(
  '/',
  [
    authMiddleware,
    requireRole(['Admin', 'Manager', 'SuperAdmin']),
    body('name')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Category name must be at least 2 characters long')
      .matches(/^[a-zA-Z0-9\s\-_&.()]+$/)
      .withMessage('Category name contains invalid characters'),
    body('brandName')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Brand name must be less than 100 characters')
  ],
  validate,
  categoryController.createCategory
);

// Create a new subcategory under a specific parent
router.post(
  '/subcategory/:parentId',
  [
    authMiddleware,
    requireRole(['Admin', 'Manager', 'SuperAdmin']),
    param('parentId').isInt({ min: 1 }).withMessage('Parent ID must be a positive integer'),
    body('name')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Subcategory name must be at least 2 characters long')
      .matches(/^[a-zA-Z0-9\s\-_&.()]+$/)
      .withMessage('Subcategory name contains invalid characters'),
    body('brandName')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Brand name must be less than 100 characters')
  ],
  validate,
  categoryController.createSubCategory
);

// Update a category
router.put(
  '/:id',
  [
    authMiddleware,
    requireRole(['Admin', 'Manager', 'SuperAdmin']),
    param('id').isInt({ min: 1 }).withMessage('Category ID must be a positive integer'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage('Category name must be at least 2 characters long')
      .matches(/^[a-zA-Z0-9\s\-_&.()]+$/)
      .withMessage('Category name contains invalid characters'),
    body('brandName')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Brand name must be less than 100 characters'),
    body('parentId')
      .optional()
      .custom((value) => {
        if (value === null || value === '' || value === 'null') {
          return true;
        }
        if (!Number.isInteger(parseInt(value)) || parseInt(value) <= 0) {
          throw new Error('Parent ID must be a positive integer or null');
        }
        return true;
      })
  ],
  validate,
  categoryController.updateCategory
);

// ADDED: Check category deletion impact
router.get(
  '/:id/deletion-check',
  [
    authMiddleware,
    requireRole(['Admin', 'Manager', 'SuperAdmin']),
    param('id').isInt({ min: 1 }).withMessage('Category ID must be a positive integer')
  ],
  validate,
  categoryController.checkCategoryDeletion
);

// ADDED: Force delete category with product handling options
router.delete(
  '/:id/force',
  [
    authMiddleware,
    requireRole(['Admin', 'Manager', 'SuperAdmin']),
    param('id').isInt({ min: 1 }).withMessage('Category ID must be a positive integer'),
    body('action')
      .isIn(['deactivate_products', 'move_to_uncategorized', 'delete_products'])
      .withMessage('Invalid action. Must be one of: deactivate_products, move_to_uncategorized, delete_products')
  ],
  validate,
  categoryController.forceDeleteCategory
);

// Delete a category and all its subcategories
router.delete(
  '/:id',
  [
    authMiddleware,
    requireRole(['Admin', 'Manager', 'SuperAdmin']),
    param('id').isInt({ min: 1 }).withMessage('Category ID must be a positive integer')
  ],
  validate,
  categoryController.deleteCategory
);

// ===============================
// Error handling middleware
// ===============================
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