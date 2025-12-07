const express = require('express');
const router = express.Router();
const sliderController = require('./controller');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { uploadSliderImages, handleUploadError } = require('../middleware/upload');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// ===============================
// Public Routes
// ===============================
// Get all sliders (with optional activeOnly filter)
router.get(
  '/',
  [
    query('activeOnly')
      .optional()
      .isIn(['true', 'false'])
      .withMessage('activeOnly must be "true" or "false"'),
  ],
  validate,
  sliderController.getAllSliders
);

// Get a single slider by ID
router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Slider ID must be a positive integer')],
  validate,
  sliderController.getSliderById
);

// ===============================
// Protected Routes (Admin/Manager only)
// ===============================
// Create a new slider
router.post(
  '/',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin,
  uploadSliderImages,
  handleUploadError,
  [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 500 })
      .withMessage('Title must be less than 500 characters'),
    body('subtitle')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Subtitle must be less than 255 characters'),
    body('desc')
      .optional()
      .trim(),
    body('cta')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('CTA must be less than 255 characters'),
    body('order')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Order must be a non-negative integer'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
  ],
  validate,
  sliderController.createSlider
);

// Update a slider
router.put(
  '/:id',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin,
  uploadSliderImages,
  handleUploadError,
  [
    param('id').isInt({ min: 1 }).withMessage('Slider ID must be a positive integer'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ max: 500 })
      .withMessage('Title must be less than 500 characters'),
    body('subtitle')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Subtitle must be less than 255 characters'),
    body('desc')
      .optional()
      .trim(),
    body('cta')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('CTA must be less than 255 characters'),
    body('order')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Order must be a non-negative integer'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('existingImages')
      .optional()
      .custom((value) => {
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed);
          } catch {
            return false;
          }
        }
        return Array.isArray(value);
      })
      .withMessage('existingImages must be a valid JSON array'),
  ],
  validate,
  sliderController.updateSlider
);

// Delete a slider
router.delete(
  '/:id',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin,
  [param('id').isInt({ min: 1 }).withMessage('Slider ID must be a positive integer')],
  validate,
  sliderController.deleteSlider
);

// Error handling middleware
router.use(handleUploadError);

router.use((error, req, res, next) => {
  console.error('Slider route error:', error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors,
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
});

module.exports = router;

