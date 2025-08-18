const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  getCategoryTree,
  getSubCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('./controller');
const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Get all categories as tree (protected, filtered by user type)
router.get(
  '/',
  authMiddleware,
  [query('userTypeId').optional().isInt().withMessage('userTypeId must be an integer')],
  validate,
  getCategoryTree
);

// Get subcategories of a parent (protected, filtered by user type)
router.get(
  '/:parentId/subcategories',
  authMiddleware,
  [
    param('parentId').isInt().withMessage('parentId must be an integer'),
    query('userTypeId').optional().isInt().withMessage('userTypeId must be an integer'),
  ],
  validate,
  getSubCategories
);

// Create new category/subcategory (Admin/Manager only)
router.post(
  '/',
  authMiddleware,
  requireRole(['Admin', 'Manager']),
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('userTypeId').isInt().withMessage('userTypeId must be an integer'),
    body('parentId').optional().isInt().withMessage('parentId must be an integer'),
  ],
  validate,
  createCategory
);

// Update category (Admin/Manager only)
router.patch(
  '/:id',
  authMiddleware,
  requireRole(['Admin', 'Manager']),
  [
    param('id').isInt().withMessage('id must be an integer'),
    body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
    body('userTypeId').optional().isInt().withMessage('userTypeId must be an integer'),
  ],
  validate,
  updateCategory
);

// Delete category + subcategories (Admin/Manager only)
router.delete(
  '/:id',
  authMiddleware,
  requireRole(['Admin', 'Manager']),
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  deleteCategory
);

module.exports = router;