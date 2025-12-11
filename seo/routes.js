// routes/seo.js (updated: aligned with moduleAccess.requireManagerOrAdmin, consistent middleware)
const express = require("express");
const router = express.Router();
const seoController = require("./controllers");
const { authenticateToken, moduleAccess } = require("../middleware/auth");
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.auth);

// Public Routes
router.get("/", auditLogger, seoController.getAllSeo);               
router.get("/pagenames", auditLogger, seoController.getAllPageNames); 
router.get("/page/:pageName", auditLogger, seoController.getSeoByPageName); 
router.get("/:id", auditLogger, seoController.getSeoById);

// Protected Routes (SuperAdmin/Admin only)
router.post("/", auditLogger, moduleAccess.requireManagerOrAdmin, seoController.createSeo);

router.put("/:id", auditLogger, moduleAccess.requireManagerOrAdmin, seoController.updateSeo);

router.delete("/:id", auditLogger, moduleAccess.requireAdmin, seoController.deleteSeo);

module.exports = router;