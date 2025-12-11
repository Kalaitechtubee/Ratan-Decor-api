// routes/enquiries.js (updated: aligned with requireSalesAccess for SuperAdmin/Admin/Sales, consistent middleware)
const express = require("express");
const router = express.Router();
const enquiryController = require("../enquiry/controller");
const {
  authenticateToken,
  moduleAccess,
  requireOwnDataOrStaff,
} = require("../middleware/auth");
const { sanitizeInput, auditLogger, rateLimits } = require("../middleware/security");

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.auth);

// Enquiry Routes
router.post("/create", auditLogger, enquiryController.createEnquiry);

router.get("/all", moduleAccess.requireSalesAccess, auditLogger, enquiryController.getAllEnquiries);

router.get("/:id", requireOwnDataOrStaff, auditLogger, enquiryController.getEnquiryById);

router.put("/:id", moduleAccess.requireSalesAccess, auditLogger, enquiryController.updateEnquiry);

router.put("/:id/status", moduleAccess.requireSalesAccess, auditLogger, enquiryController.updateEnquiryStatus);

router.delete("/:id", moduleAccess.requireSalesAccess, auditLogger, enquiryController.deleteEnquiry);

// Internal Notes
router.post("/:id/internal-notes", moduleAccess.requireSalesAccess, auditLogger, enquiryController.addInternalNote);
router.get("/:id/internal-notes", moduleAccess.requireSalesAccess, auditLogger, enquiryController.getInternalNotes);
router.put("/internal-notes/:noteId", moduleAccess.requireSalesAccess, auditLogger, enquiryController.updateInternalNote);
router.delete("/internal-notes/:noteId", moduleAccess.requireSalesAccess, auditLogger, enquiryController.deleteInternalNote);

// Follow-up Dashboard
router.get("/dashboard/follow-ups", moduleAccess.requireSalesAccess, auditLogger, enquiryController.getFollowUpDashboard);

// Error handling
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