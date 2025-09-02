// routes/videoCallEnquiry.js - Video Call Enquiries Routes
const express = require('express');
const router = express.Router();
const videoCallEnquiryController = require('../videoCallEnquiry/controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');
const { sanitizeInput, auditLogger } = require('../middleware/security');

// All routes require authentication
router.use(authenticateToken);
router.use(sanitizeInput);

// Create video call enquiry (any authenticated user)
router.post('/create', auditLogger, videoCallEnquiryController.create);

// Get own enquiries (any authenticated user)
router.get('/my-enquiries', videoCallEnquiryController.getMyEnquiries);

// Staff-only routes for managing all enquiries (Sales team access)
router.get('/all',
  moduleAccess.requireSalesAccess,
  videoCallEnquiryController.getAll
);

router.get('/:id',
  requireOwnDataOrStaff,
  videoCallEnquiryController.getById
);

router.put('/:id',
  moduleAccess.requireSalesAccess,
  auditLogger,
  videoCallEnquiryController.update
);

router.delete('/:id',
  moduleAccess.requireSalesAccess,
  auditLogger,
  videoCallEnquiryController.delete
);

// INTERNAL NOTES ROUTES (Sales team only)
router.post('/:id/internal-notes',
  moduleAccess.requireSalesAccess,
  auditLogger,
  videoCallEnquiryController.addInternalNote
);

router.get('/:id/internal-notes',
  moduleAccess.requireSalesAccess,
  videoCallEnquiryController.getInternalNotes
);

router.put('/internal-notes/:noteId',
  moduleAccess.requireSalesAccess,
  auditLogger,
  videoCallEnquiryController.updateInternalNote
);

router.delete('/internal-notes/:noteId',
  moduleAccess.requireSalesAccess,
  auditLogger,
  videoCallEnquiryController.deleteInternalNote
);

// FOLLOW-UP DASHBOARD (Sales team dashboard)
router.get('/dashboard/follow-ups',
  moduleAccess.requireSalesAccess,
  videoCallEnquiryController.getFollowUpDashboard
);

module.exports = router;
