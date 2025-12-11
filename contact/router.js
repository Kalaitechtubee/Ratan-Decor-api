// routes/contact.js (updated: aligned with permissions table using requireContactsAccess)
const express = require('express');
const router = express.Router();
const ContactController = require('./contactController');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(sanitizeInput);
router.use(rateLimits.general);

// Public route
router.post('/submit', auditLogger, ContactController.submitContactForm);

// Protected routes (SuperAdmin, Admin, Support, Sales)
router.get('/all', authenticateToken, moduleAccess.requireContactsAccess, auditLogger, ContactController.getAllContacts);
router.get('/:id', authenticateToken, moduleAccess.requireContactsAccess, auditLogger, ContactController.getContactById);

// Error handling
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