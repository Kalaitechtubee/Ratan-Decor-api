// backend/productUsageType/routes.js
const express = require("express");
const router = express.Router();
const controller = require("./controller");

router.post("/", controller.createProductUsageType);
router.get("/", controller.getAllProductUsageTypes);
router.get("/:id", controller.getProductUsageTypeById);
router.put("/:id", controller.updateProductUsageType);
router.patch("/:id/toggle", controller.toggleProductUsageTypeStatus);

module.exports = router;