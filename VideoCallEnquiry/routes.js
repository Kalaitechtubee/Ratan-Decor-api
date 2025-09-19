// routes/videoCallEnquiry.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const videoCallEnquiryController = require('./controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');
const { sanitizeInput, auditLogger } = require('../middleware/security');

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

/* --------------------------------- PUBLIC (Unauthenticated or Authenticated User) ----------------------------------*/
// Create video call enquiry (no authentication required)
router.post('/create', sanitizeInput, auditLogger, videoCallEnquiryController.create);

// Get own enquiries (requires authentication)
router.get('/my-enquiries', ...authenticatedRoutes, videoCallEnquiryController.getMyEnquiries);

/* --------------------------------- STAFF (Sales/Admin/Manager/SuperAdmin) ----------------------------------*/
// Get all video call enquiries
router.get('/all', ...authenticatedRoutes, moduleAccess.requireSalesAccess, videoCallEnquiryController.getAll);

// Get specific enquiry (own, staff, or unauthenticated with matching email query param)
router.get('/:id', optionalAuth, sanitizeInput, videoCallEnquiryController.getById);

// Update enquiry (own or staff)
router.put('/:id', ...authenticatedRoutes, requireOwnDataOrStaff, auditLogger, videoCallEnquiryController.update);

// Delete enquiry (own or staff)
router.delete('/:id', ...authenticatedRoutes, requireOwnDataOrStaff, auditLogger, videoCallEnquiryController.delete);

/* --------------------------------- INTERNAL NOTES (Staff only) ----------------------------------*/
router.post('/:id/internal-notes', ...authenticatedRoutes, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.addInternalNote);
router.get('/:id/internal-notes', ...authenticatedRoutes, moduleAccess.requireSalesAccess, videoCallEnquiryController.getInternalNotes);
router.put('/internal-notes/:noteId', ...authenticatedRoutes, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.updateInternalNote);
router.delete('/internal-notes/:noteId', ...authenticatedRoutes, moduleAccess.requireSalesAccess, auditLogger, videoCallEnquiryController.deleteInternalNote);

/* --------------------------------- FOLLOW-UP DASHBOARD (Staff only) ----------------------------------*/
router.get('/dashboard/follow-ups', ...authenticatedRoutes, moduleAccess.requireSalesAccess, videoCallEnquiryController.getFollowUpDashboard);

module.exports = router;