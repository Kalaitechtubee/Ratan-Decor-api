// routes/enquiries.js (role-based access logic completely removed)
const express = require("express");
const router = express.Router();
const enquiryController = require("../enquiry/controller");
const {
  authenticateToken,
} = require("../middleware/auth");
const { sanitizeInput, auditLogger, rateLimits } = require("../middleware/security");

// Global middlewares (authentication + security only)
router.use(authenticateToken);     // Must be logged in
router.use(sanitizeInput);         // Prevent XSS / injection
router.use(rateLimits.auth);       // Rate limiting for authenticated users

// Enquiry Routes (no role restrictions)
router.post("/create", auditLogger, enquiryController.createEnquiry);

router.get("/all", auditLogger, enquiryController.getAllEnquiries);

router.get("/:id", auditLogger, enquiryController.getEnquiryById);

router.put("/:id", auditLogger, enquiryController.updateEnquiry);

router.put("/:id/status", auditLogger, enquiryController.updateEnquiryStatus);

router.delete("/:id", auditLogger, enquiryController.deleteEnquiry);

// Internal Notes (no role restrictions)
router.post("/:id/internal-notes", auditLogger, enquiryController.addInternalNote);
router.get("/:id/internal-notes", auditLogger, enquiryController.getInternalNotes);
router.put("/internal-notes/:noteId", auditLogger, enquiryController.updateInternalNote);
router.delete("/internal-notes/:noteId", auditLogger, enquiryController.deleteInternalNote);

// Follow-up Dashboard
router.get("/dashboard/follow-ups", auditLogger, enquiryController.getFollowUpDashboard);

// Centralized error handling
router.use((error, req, res, next) => {
  console.error('Enquiry route error:', error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors || error.message
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

module.exports = router;