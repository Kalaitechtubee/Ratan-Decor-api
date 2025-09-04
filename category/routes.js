// routes/category.js - Category Management Routes
const express = require('express');
const router = express.Router();
const categoryController = require('./controller');
const { body, param, query, validationResult } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware');

// ===============================
// Validation middleware
// ===============================
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

// ===============================
// Public Routes
// ===============================

// Get all categories as a tree structure
router.get('/', categoryController.getCategoryTree);

// Search categories by name
router.get(
  '/search',
  [query('q').trim().notEmpty().withMessage('Search query is required')],
  validate,
  categoryController.searchCategories
);

// Get subcategories for a specific parent category
router.get(
  '/subcategories/:parentId',
  [param('parentId').isInt().withMessage('Parent ID must be an integer')],
  validate,
  categoryController.getSubCategories
);

// Get a specific category by ID
router.get(
  '/:id',
  [param('id').isInt().withMessage('Category ID must be an integer')],
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
    requireRole(['Admin', 'Manager']),
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('brandName').optional().trim()
  ],
  validate,
  categoryController.createCategory
);

// Create a new subcategory under a specific parent
router.post(
  '/subcategory/:parentId',
  [
    authMiddleware,
    requireRole(['Admin', 'Manager']),
    param('parentId').isInt().withMessage('Parent ID must be an integer'),
    body('name').trim().notEmpty().withMessage('Subcategory name is required'),
    body('brandName').optional().trim()
  ],
  validate,
  categoryController.createSubCategory
);

// Update a category
router.put(
  '/:id',
  [
    authMiddleware,
    requireRole(['Admin', 'Manager']),
    param('id').isInt().withMessage('Category ID must be an integer'),
    body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
    body('brandName').optional().trim(),
    body('parentId').optional().isInt().withMessage('Parent ID must be an integer')
  ],
  validate,
  categoryController.updateCategory
);

// Delete a category and all its subcategories
router.delete(
  '/:id',
  [
    authMiddleware,
    requireRole(['Admin', 'Manager']),
    param('id').isInt().withMessage('Category ID must be an integer')
  ],
  validate,
  categoryController.deleteCategory
);

module.exports = router;
