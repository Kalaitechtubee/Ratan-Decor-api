// routes/seo.js (clean version — role-based access removed)
const express = require("express");
const router = express.Router();

const seoController = require("./controllers");
const { authenticateToken } = require("../middleware/auth");
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares - Sanitization and rate limiting for all
router.use(sanitizeInput);
router.use(rateLimits.auth);

// Public Routes (GET requests for SEO data)
router.get("/", auditLogger, seoController.getAllSeo);
router.get("/pagenames", auditLogger, seoController.getAllPageNames);
router.get("/page/:pageName", auditLogger, seoController.getSeoByPageName);
router.get("/:id", auditLogger, seoController.getSeoById);

// Protected Routes (Mutations require token)
router.post("/", authenticateToken, auditLogger, seoController.createSeo);
router.put("/:id", authenticateToken, auditLogger, seoController.updateSeo);
router.delete("/:id", authenticateToken, auditLogger, seoController.deleteSeo);

module.exports = router;
