// Updated routes/enquiries.js - Add internal notes routes
const express = require('express');
const router = express.Router();
const enquiryController = require('../enquiry/controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Create enquiry (any authenticated user)
router.post('/create', enquiryController.createEnquiry);

// Get all enquiries (Admin, Manager, Sales only)
router.get('/all',
  moduleAccess.requireSalesAccess,
  enquiryController.getAllEnquiries
);

// Get specific enquiry (own data or staff)
router.get('/:id',
  requireOwnDataOrStaff,
  enquiryController.getEnquiryById
);

// Update enquiry (Admin, Manager, Sales only)
router.put('/:id',
  moduleAccess.requireSalesAccess,
  enquiryController.updateEnquiry
);

// Update enquiry status (Admin, Manager, Sales only)
router.put('/:id/status',
  moduleAccess.requireSalesAccess,
  enquiryController.updateEnquiryStatus
);

// NEW: INTERNAL NOTES ROUTES (Staff only)
router.post('/:id/internal-notes',
  moduleAccess.requireSalesAccess,
  enquiryController.addInternalNote
);

router.get('/:id/internal-notes',
  moduleAccess.requireSalesAccess,
  enquiryController.getInternalNotes
);

router.put('/internal-notes/:noteId',
  moduleAccess.requireSalesAccess,
  enquiryController.updateInternalNote
);

router.delete('/internal-notes/:noteId',
  moduleAccess.requireSalesAccess,
  enquiryController.deleteInternalNote
);

// NEW: FOLLOW-UP DASHBOARD
router.get('/dashboard/follow-ups',
  moduleAccess.requireSalesAccess,
  enquiryController.getFollowUpDashboard
);

module.exports = router;