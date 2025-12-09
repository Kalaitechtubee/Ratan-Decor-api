// routes/videoCallEnquiry.js - Updated without express-validator
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const videoCallEnquiryController = require('./controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Optional authentication middleware (sets req.user if valid token, otherwise null; does not 401)
const optionalAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Assumes decoded contains id, role, etc.
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

// Middleware for authentication and sanitization (applied selectively)
const authenticatedRoutes = [authenticateToken, sanitizeInput];

// Apply general rate limit to protected routes
router.use('/my-enquiries', rateLimits.general);
router.use('/all', rateLimits.general);

/* --------------------------------- PUBLIC (Unauthenticated or Authenticated User) ----------------------------------*/
// Create video call enquiry (no authentication required)
router.post('/create', sanitizeInput, auditLogger, videoCallEnquiryController.create);

// Get own enquiries (requires authentication) - SuperAdmin/Admin can see all via staff access
router.get('/my-enquiries', [...authenticatedRoutes, auditLogger], videoCallEnquiryController.getMyEnquiries);

/* --------------------------------- STAFF (Sales/Admin/Manager/SuperAdmin) ----------------------------------*/
// Get all video call enquiries - SuperAdmin/Admin have full access
router.get('/all', [...authenticatedRoutes, auditLogger], moduleAccess.requireSalesAccess, videoCallEnquiryController.getAll);

// Get specific enquiry (own, staff, or unauthenticated with matching email query param)
router.get('/:id', optionalAuth, sanitizeInput, videoCallEnquiryController.getById);

// Update enquiry (own or staff) - SuperAdmin/Admin bypass ownership via staff check
router.put('/:id', [...authenticatedRoutes, auditLogger, rateLimits.general], requireOwnDataOrStaff, videoCallEnquiryController.update);

// Delete enquiry (own or staff) - SuperAdmin/Admin full access
router.delete('/:id', [...authenticatedRoutes, auditLogger, rateLimits.general], requireOwnDataOrStaff, videoCallEnquiryController.delete);

/* --------------------------------- INTERNAL NOTES (Staff only) - SuperAdmin/Admin access ----------------------------------*/
router.post('/:id/internal-notes', [...authenticatedRoutes, auditLogger, rateLimits.general], moduleAccess.requireSalesAccess, videoCallEnquiryController.addInternalNote);

router.get('/:id/internal-notes', [...authenticatedRoutes, auditLogger], moduleAccess.requireSalesAccess, videoCallEnquiryController.getInternalNotes);

router.put('/internal-notes/:noteId', [...authenticatedRoutes, auditLogger, rateLimits.general], moduleAccess.requireSalesAccess, videoCallEnquiryController.updateInternalNote);

router.delete('/internal-notes/:noteId', [...authenticatedRoutes, auditLogger, rateLimits.general], moduleAccess.requireSalesAccess, videoCallEnquiryController.deleteInternalNote);

/* --------------------------------- FOLLOW-UP DASHBOARD (Staff only) - SuperAdmin/Admin access ----------------------------------*/
router.get('/dashboard/follow-ups', [...authenticatedRoutes, auditLogger, rateLimits.general], moduleAccess.requireSalesAccess, videoCallEnquiryController.getFollowUpDashboard);

// Global error handling
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