// routes/seo.js - Updated with proper middleware and route handlers
const express = require("express");
const router = express.Router();
const seoController = require("./controllers");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(authenticateToken); // Require authentication for all routes
router.use(sanitizeInput);
router.use(rateLimits.auth);

// ==========================
// Public Routes
// ==========================
router.get("/", auditLogger, seoController.getAllSeo);               
router.get("/pagenames", auditLogger, seoController.getAllPageNames); 
router.get("/page/:pageName", auditLogger, seoController.getSeoByPageName); 
router.get("/:id", auditLogger, seoController.getSeoById);

// ==========================
// Protected Routes (Admin/Manager/SuperAdmin Only)
// ==========================
router.post("/", 
  auditLogger,
  authorizeRoles(["Admin", "Manager", "SuperAdmin"]),
  seoController.createSeo
);

router.put("/:id", 
  auditLogger,
  authorizeRoles(["Admin", "Manager", "SuperAdmin"]),
  seoController.updateSeo
);

router.delete("/:id", 
  auditLogger,
  authorizeRoles(["Admin", "SuperAdmin"]),
  seoController.deleteSeo
);

module.exports = router;