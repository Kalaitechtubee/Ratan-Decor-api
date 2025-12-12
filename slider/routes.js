// routes/slider.js (clean version: removed all role-based access)
const express = require('express');
const router = express.Router();
const sliderController = require('./controller');

const { authenticateToken } = require('../middleware/auth');
const { uploadSliderImages, handleUploadError } = require('../middleware/upload');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ================================
// Public Routes
// ================================
router.get('/', sliderController.getAllSliders);
router.get('/:id', sliderController.getSliderById);

// ================================
// Protected Routes (Token only — no role checks)
// ================================
router.post(
  '/',
  authenticateToken,
  sanitizeInput,
  rateLimits.general,
  uploadSliderImages,
  handleUploadError,
  auditLogger,
  sliderController.createSlider
);

router.put(
  '/:id',
  authenticateToken,
  sanitizeInput,
  rateLimits.general,
  uploadSliderImages,
  handleUploadError,
  auditLogger,
  sliderController.updateSlider
);

router.delete(
  '/:id',
  authenticateToken,
  sanitizeInput,
  rateLimits.general,
  auditLogger,
  sliderController.deleteSlider
);

// ================================
// Error Handling
// ================================
router.use(handleUploadError);

router.use((error, req, res, next) => {
  console.error('Slider route error:', error);

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
