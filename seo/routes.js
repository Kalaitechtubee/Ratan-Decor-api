const express = require("express");
const router = express.Router();
const seoController = require("./controllers");

// All routes are now public
router.get("/", seoController.getAllSeo); // Get all page SEO details
router.get("/pagenames", seoController.getAllPageNames); // Get all page names
router.get("/:id", seoController.getSeoById);
router.get("/page/:pageName", seoController.getSeoByPageName);
router.post("/", seoController.createSeo);
router.put("/:id", seoController.updateSeo);
router.delete("/:id", seoController.deleteSeo);

module.exports = router;