// routes/enquiries.js - Enquiries Management Routes
const express = require("express");
const router = express.Router();
const enquiryController = require("../enquiry/controller");
const {
  authenticateToken,
  moduleAccess,
  requireOwnDataOrStaff,
} = require("../middleware/auth");
const { sanitizeInput, auditLogger } = require("../middleware/security");

// ===============================
// Global middlewares for this router
// ===============================
router.use(authenticateToken); // All routes require authentication
router.use(sanitizeInput);     // Sanitize request input

// ===============================
// Enquiry Routes
// ===============================

// Create enquiry (any authenticated user)
router.post("/create", auditLogger, enquiryController.createEnquiry);

// Get all enquiries (Admin, Manager, Sales only)
router.get(
  "/all",
  moduleAccess.requireSalesAccess,
  enquiryController.getAllEnquiries
);

// Get specific enquiry (own data OR staff roles)
router.get(
  "/:id",
  requireOwnDataOrStaff,
  enquiryController.getEnquiryById
);

// Update enquiry (Admin, Manager, Sales only)
router.put(
  "/:id",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.updateEnquiry
);

// Update enquiry status (Admin, Manager, Sales only)
router.put(
  "/:id/status",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.updateEnquiryStatus
);

// Delete enquiry (Admin, Manager, Sales only)
router.delete(
  "/:id",
  moduleAccess.requireSalesAccess,
  auditLogger,
  enquiryController.deleteEnquiry
);

// ===============================
// Internal Notes (Sales team feature)
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
// Follow-up Dashboard (Sales team feature)
// ===============================
router.get(
  "/dashboard/follow-ups",
  moduleAccess.requireSalesAccess,
  enquiryController.getFollowUpDashboard
);

module.exports = router;
