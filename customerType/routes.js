// backend/customerType/routes.js
const express = require("express");
const router = express.Router();
const controller = require("./controller");

router.post("/", controller.createCustomerType);
router.get("/", controller.getAllCustomerTypes);
router.patch("/:id/toggle", controller.toggleCustomerTypeStatus);

module.exports = router;