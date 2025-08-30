const express = require("express");
const router = express.Router();
const videoCallEnquiryController = require("./controller");
const { authMiddleware: authenticateToken, requireRole: authorizeRoles } = require("../middleware");

router.use(authenticateToken);

// ✅ Allow *any logged-in user* to create an enquiry (note lowercase roles)
router.post(
  "/create",
  authorizeRoles(["admin", "manager", "sales", "support", "customer"]), // ✅ Fixed: lowercase
  videoCallEnquiryController.create
);

// ✅ Customer can view their own enquiries
router.get(
  "/my-enquiries",
  authorizeRoles(["admin", "manager", "sales", "support", "customer"]),
  videoCallEnquiryController.getMyEnquiries
);

// ✅ Staff only: get all enquiries
router.get(
  "/all",
  authorizeRoles(["admin", "manager", "sales", "support"]), // ✅ Fixed: lowercase
  videoCallEnquiryController.getAll
);

// ✅ Staff only: get by ID
router.get(
  "/:id",
  authorizeRoles(["admin", "manager", "sales", "support"]), // ✅ Fixed: lowercase
  videoCallEnquiryController.getById
);

// ✅ Staff only: update enquiry
router.put(
  "/:id",
  authorizeRoles(["admin", "manager", "sales", "support"]), // ✅ Fixed: lowercase
  videoCallEnquiryController.update
);

// ✅ Staff only: delete enquiry
router.delete(
  "/:id",
  authorizeRoles(["admin", "manager", "sales"]), // ✅ Fixed: lowercase
  videoCallEnquiryController.delete
);

module.exports = router;