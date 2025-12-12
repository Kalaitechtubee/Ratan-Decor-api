// routes/userType.js (clean version: removed all role-based access)
const express = require('express');
const router = express.Router();

const userTypeController = require('./controller');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');
const { uploadUserTypeIcon, handleUploadError } = require('../middleware/upload');

// Public routes
router.get('/', userTypeController.getAllUserTypes);
router.get('/:id', userTypeController.getUserTypeById);

// Protected routes (token only — no role checks)
router.post(
  '/',
  authenticateToken,
  sanitizeInput,
  uploadUserTypeIcon,
  handleUploadError,
  auditLogger,
  rateLimits.general,
  userTypeController.createUserType
);

router.put(
  '/:id',
  authenticateToken,
  sanitizeInput,
  uploadUserTypeIcon,
  handleUploadError,
  auditLogger,
  rateLimits.general,
  userTypeController.updateUserType
);

router.delete(
  '/:id',
  authenticateToken,
  sanitizeInput,
  auditLogger,
  rateLimits.general,
  userTypeController.deleteUserType
);

// Error handling
router.use(handleUploadError);

router.use((error, req, res, next) => {
  console.error('UserType route error:', error);

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
