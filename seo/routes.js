// routes/seo.js - Updated without express-validator
const express = require("express");
const router = express.Router();
const seoController = require("./controllers");
const { authMiddleware, authorizeRoles } = require("../middleware");
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(sanitizeInput);
router.use(rateLimits.general);

// ==========================
// Public Routes
// ==========================
router.get("/", auditLogger, seoController.getAllSeo);               
router.get("/pagenames", auditLogger, seoController.getAllPageNames); 
router.get("/page/:pageName", auditLogger, seoController.getSeoByPageName); 
router.get("/:id", auditLogger, seoController.getSeoById);

// ==========================
// Protected Routes (Admin/Manager/SuperAdmin Only)
router.post("/", 
  authMiddleware, 
  authorizeRoles(["Admin", "Manager", "SuperAdmin"]), // Explicit SuperAdmin
  auditLogger,
  seoController.createSeo
);

router.put("/:id", 
  authMiddleware, 
  authorizeRoles(["Admin", "Manager", "SuperAdmin"]),
  auditLogger,
  seoController.updateSeo
);

router.delete("/:id", 
  authMiddleware, 
  authorizeRoles(["Admin", "Manager", "SuperAdmin"]),
  auditLogger,
  seoController.deleteSeo
);

module.exports = router;