// routes/videoCallEnquiry.js (updated: unified with enquiries logic, aligned requireSalesAccess and requireOwnDataOrStaff, removed optionalAuth for consistency)
const express = require('express');
const router = express.Router();
const videoCallEnquiryController = require('./controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares for protected routes
router.use('/my-enquiries', authenticateToken, sanitizeInput, rateLimits.general);
router.use('/all', authenticateToken, sanitizeInput, rateLimits.general);

// Public: Create video call enquiry
router.post('/create', sanitizeInput, auditLogger, videoCallEnquiryController.create);

// Authenticated: Get own enquiries
router.get('/my-enquiries', auditLogger, videoCallEnquiryController.getMyEnquiries);

// Staff: Get all
router.get('/all', moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.getAll);

// Get specific (own or staff)
router.get('/:id', authenticateToken, sanitizeInput, requireOwnDataOrStaff, auditLogger, videoCallEnquiryController.getById);

// Update (own or staff)
router.put('/:id', authenticateToken, sanitizeInput, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.update);

// Delete (own or staff)
router.delete('/:id', authenticateToken, sanitizeInput, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.delete);

// Internal Notes (staff)
router.post('/:id/internal-notes', authenticateToken, sanitizeInput, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.addInternalNote);
router.get('/:id/internal-notes', authenticateToken, sanitizeInput, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.getInternalNotes);
router.put('/internal-notes/:noteId', authenticateToken, sanitizeInput, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.updateInternalNote);
router.delete('/internal-notes/:noteId', authenticateToken, sanitizeInput, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.deleteInternalNote);

// Follow-up Dashboard (staff)
router.get('/dashboard/follow-ups', authenticateToken, sanitizeInput, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.getFollowUpDashboard);

// Error handling
router.use((error, req, res, next) => {
  console.error('Video Call Enquiry route error:', error);
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