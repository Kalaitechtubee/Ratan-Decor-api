// backend/userType/routes.js
const express = require("express");
const router = express.Router();
const controller = require("./userTypeController"); // ✅

router.post("/", controller.createUserType);
router.get("/", controller.getAllUserTypes);
router.patch("/:id/toggle", controller.toggleUserTypeStatus);

module.exports = router;
