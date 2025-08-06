const express = require("express");
const router = express.Router();
const controller = require("./subcategoryController");

router.post("/", controller.createSubcategory);
router.get("/", controller.getAllSubcategories);

module.exports = router;
