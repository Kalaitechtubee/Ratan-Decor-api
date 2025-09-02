// routes/enquiries.js - Enquiries Management Routes
const express = require('express');
const router = express.Router();
const enquiryController = require('../enquiry/controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');
const { sanitizeInput, auditLogger } = require('../middleware/security');

// All routes require authentication
router.use(authenticateToken);
router.use(sanitizeInput);

// Create enquiry (any authenticated user)
router.post('/create', auditLogger, enquiryController.createEnquiry);

// Get all enquiries (Admin, Manager, Sales only - Sales team specialization)
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
  auditLogger,
  enquiryController.updateEnquiry
);

// Update enquiry status (Admin, Manager, Sales only)
router.put('/:id/status',
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.updateEnquiryStatus
);

// Delete enquiry (Admin, Manager, Sales only)
router.delete('/:id',
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.deleteEnquiry
);

// INTERNAL NOTES ROUTES (Sales team features)
router.post('/:id/internal-notes',
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.addInternalNote
);

router.get('/:id/internal-notes',
  moduleAccess.requireSalesAccess,
  enquiryController.getInternalNotes
);

router.put('/internal-notes/:noteId',
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.updateInternalNote
);

router.delete('/internal-notes/:noteId',
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.deleteInternalNote
);

// FOLLOW-UP DASHBOARD (Sales team dashboard)
router.get('/dashboard/follow-ups',
  moduleAccess.requireSalesAccess,
  enquiryController.getFollowUpDashboard
);

module.exports = router;