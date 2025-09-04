// routes/videoCallEnquiry.js - Video Call Enquiries Routes
const express = require('express');
const router = express.Router();
const videoCallEnquiryController = require('../videoCallEnquiry/controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');
const { sanitizeInput, auditLogger } = require('../middleware/security');

// All routes require authentication
router.use(authenticateToken);
router.use(sanitizeInput);

/* ---------------------------------
   PUBLIC (Any Authenticated User)
----------------------------------*/

// Create video call enquiry
router.post('/create', auditLogger, videoCallEnquiryController.create);

// Get own enquiries
router.get('/my-enquiries', videoCallEnquiryController.getMyEnquiries);

/* ---------------------------------
   STAFF (Sales/Admin/Manager/SuperAdmin)
----------------------------------*/

// Get all video call enquiries
router.get('/all',
  moduleAccess.requireSalesAccess, // Sales + higher roles
  videoCallEnquiryController.getAll
);

// Get specific enquiry
router.get('/:id',
  requireOwnDataOrStaff,
  videoCallEnquiryController.getById
);

// Update enquiry
router.put('/:id',
  moduleAccess.requireSalesAccess,
  auditLogger,
  videoCallEnquiryController.update
);

// Delete enquiry
router.delete('/:id',
  moduleAccess.requireSalesAccess,
  auditLogger,
  videoCallEnquiryController.delete
);

/* ---------------------------------
   INTERNAL NOTES (Sales/Admin/Manager/SuperAdmin)
----------------------------------*/
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

/* ---------------------------------
   FOLLOW-UP DASHBOARD (Sales/Admin/Manager/SuperAdmin)
----------------------------------*/
router.get('/dashboard/follow-ups',
  moduleAccess.requireSalesAccess,
  videoCallEnquiryController.getFollowUpDashboard
);

module.exports = router;
