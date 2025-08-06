const express = require("express");
const router = express.Router();
const controller = require("./categoryController");

router.post("/", controller.createCategory);
router.get("/", controller.getAllCategories);

module.exports = router;
