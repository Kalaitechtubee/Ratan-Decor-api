// routes/videoCallEnquiry.js (ALL role-based access removed – auth-only where needed)
const express = require('express');
const router = express.Router();
const videoCallEnquiryController = require('./controller');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares (applied only where needed)
router.use(sanitizeInput);
router.use(rateLimits.general);

// Public: Anyone can create a video call enquiry
router.post('/create', auditLogger, videoCallEnquiryController.create);

// Authenticated user: Get my own enquiries
router.get('/my-enquiries', authenticateToken, auditLogger, videoCallEnquiryController.getMyEnquiries);

// Anyone authenticated can view all (previously staff-only)
router.get('/all', authenticateToken, auditLogger, videoCallEnquiryController.getAll);

// Get specific enquiry by ID (any authenticated user)
router.get('/:id', authenticateToken, auditLogger, videoCallEnquiryController.getById);

// Update any enquiry (any authenticated user)
router.put('/:id', authenticateToken, auditLogger, videoCallEnquiryController.update);

// Delete any enquiry (any authenticated user)
router.delete('/:id', authenticateToken, auditLogger, videoCallEnquiryController.delete);

// Internal Notes – now accessible to any authenticated user
router.post('/:id/internal-notes', authenticateToken, auditLogger, videoCallEnquiryController.addInternalNote);
router.get('/:id/internal-notes', authenticateToken, auditLogger, videoCallEnquiryController.getInternalNotes);
router.put('/internal-notes/:noteId', authenticateToken, auditLogger, videoCallEnquiryController.updateInternalNote);
router.delete('/internal-notes/:noteId', authenticateToken, auditLogger, videoCallEnquiryController.deleteInternalNote);

// Follow-up Dashboard – now accessible to any authenticated user
router.get('/dashboard/follow-ups', authenticateToken, auditLogger, videoCallEnquiryController.getFollowUpDashboard);

// Error handling
router.use((error, req, res, next) => {
  console.error('Video Call Enquiry route error:', error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors || error.message
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

module.exports = router;