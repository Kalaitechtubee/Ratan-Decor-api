const express = require('express');
const router = express.Router();
const ContactController = require('./contactController');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

router.use(sanitizeInput);
router.use(rateLimits.general);

router.post('/submit', auditLogger, ContactController.submitContactForm);
router.get('/all', auditLogger, ContactController.getAllContacts);
router.get('/:id', auditLogger, ContactController.getContactById);

router.use((error, req, res, next) => {
  console.error('Contact route error:', error);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = router;