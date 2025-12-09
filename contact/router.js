// routes/contact.js - Updated without express-validator
const express = require('express');
const router = express.Router();
const ContactController = require('./contactController');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(sanitizeInput); // Global sanitization
router.use(rateLimits.general); // Global rate limiting

// Public route: Submit contact form (no auth required)
router.post('/submit',
  auditLogger,
  ContactController.submitContactForm
);

// Protected routes (Admin/SuperAdmin/Manager for viewing)
router.get('/all',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  auditLogger,
  ContactController.getAllContacts
);

router.get('/:id',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  auditLogger,
  ContactController.getContactById
);

// Global error handling
router.use((error, req, res, next) => {
  console.error('Contact route error:', error);
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