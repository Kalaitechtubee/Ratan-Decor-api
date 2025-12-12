// routes/seo.js (clean version — role-based access removed)
const express = require("express");
const router = express.Router();

const seoController = require("./controllers");
const { authenticateToken } = require("../middleware/auth");
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.auth);

// Public Authenticated Routes
router.get("/", auditLogger, seoController.getAllSeo);
router.get("/pagenames", auditLogger, seoController.getAllPageNames);
router.get("/page/:pageName", auditLogger, seoController.getSeoByPageName);
router.get("/:id", auditLogger, seoController.getSeoById);

// Protected Routes (token only — no role checks)
router.post("/", auditLogger, seoController.createSeo);

router.put("/:id", auditLogger, seoController.updateSeo);

router.delete("/:id", auditLogger, seoController.deleteSeo);

module.exports = router;
