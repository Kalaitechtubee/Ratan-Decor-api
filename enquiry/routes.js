// routes/enquiries.js - Updated without express-validator
const express = require("express");
const router = express.Router();
const enquiryController = require("../enquiry/controller");
const {
  authenticateToken,
  moduleAccess,
  requireOwnDataOrStaff,
} = require("../middleware/auth");
const { sanitizeInput, auditLogger, rateLimits } = require("../middleware/security");

// ===============================
// Global middlewares for this router
// ===============================
router.use(authenticateToken); // All routes require authentication
router.use(sanitizeInput);     // Sanitize request input
router.use(rateLimits.general); // Global rate limiting

// ===============================
// Enquiry Routes
// ===============================

// Create enquiry (any authenticated user)
router.post("/create", auditLogger, enquiryController.createEnquiry);

// Get all enquiries (Admin, Manager, Sales only - SuperAdmin/Admin included)
router.get(
  "/all",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.getAllEnquiries
);

// Get specific enquiry (own data OR staff roles - SuperAdmin/Admin bypass)
router.get(
  "/:id",
  requireOwnDataOrStaff,
  auditLogger,
  enquiryController.getEnquiryById
);

// Update enquiry (Admin, Manager, Sales only - SuperAdmin/Admin included)
router.put(
  "/:id",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.updateEnquiry
);

// Update enquiry status (Admin, Manager, Sales only - SuperAdmin/Admin included)
router.put(
  "/:id/status",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.updateEnquiryStatus
);

// Delete enquiry (Admin, Manager, Sales only - SuperAdmin/Admin included)
router.delete(
  "/:id",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.deleteEnquiry
);

// ===============================
// Internal Notes (Sales team feature - SuperAdmin/Admin included)
// ===============================
router.post(
  "/:id/internal-notes",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.addInternalNote
);

router.get(
  "/:id/internal-notes",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.getInternalNotes
);

router.put(
  "/internal-notes/:noteId",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.updateInternalNote
);

router.delete(
  "/internal-notes/:noteId",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.deleteInternalNote
);

// ===============================
// Follow-up Dashboard (Sales team feature - SuperAdmin/Admin included)
// ===============================
router.get(
  "/dashboard/follow-ups",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.getFollowUpDashboard
);

// Global error handling for this router
router.use((error, req, res, next) => {
  console.error('Enquiry route error:', error);
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