// routes/slider.js - Updated without express-validator
const express = require('express');
const router = express.Router();
const sliderController = require('./controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { uploadSliderImages, handleUploadError } = require('../middleware/upload');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Public Routes
// ===============================
// Get all sliders (with optional activeOnly filter)
router.get('/', sliderController.getAllSliders);

// Get a single slider by ID
router.get('/:id', sliderController.getSliderById);

// ===============================
// Protected Routes (Admin/Manager/SuperAdmin only)
// ===============================
// Create a new slider
router.post(
  '/',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  sanitizeInput,
  rateLimits.general,
  uploadSliderImages,
  handleUploadError,
  auditLogger,
  sliderController.createSlider
);

// Update a slider
router.put(
  '/:id',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  sanitizeInput,
  rateLimits.general,
  uploadSliderImages,
  handleUploadError,
  auditLogger,
  sliderController.updateSlider
);

// Delete a slider
router.delete(
  '/:id',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  sanitizeInput,
  rateLimits.general,
  auditLogger,
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