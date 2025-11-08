const express = require("express");
const router = express.Router();
const seoController = require("./controllers");
const { authMiddleware, authorizeRoles } = require("../middleware");

// ==========================
// Public Routes
// ==========================
router.get("/", seoController.getAllSeo);               // Get all page SEO details
router.get("/pagenames", seoController.getAllPageNames); // Get all page names
router.get("/:id", seoController.getSeoById);           
router.get("/page/:pageName", seoController.getSeoByPageName);

// ==========================
// Protected Routes (Admin/Manager Only)
// ==========================
router.post("/", authMiddleware, authorizeRoles(["admin", "manager"]), seoController.createSeo);
router.put("/:id", authMiddleware, authorizeRoles(["admin", "manager"]), seoController.updateSeo);
router.delete("/:id", authMiddleware, authorizeRoles(["admin"]), seoController.deleteSeo);

module.exports = router;
