// middleware/auth.js - Corrected version with SuperAdmin having full access
const jwt = require('jsonwebtoken');
const { User, UserType, VideoCallEnquiry } = require('../models');

// -----------------------------
// Authentication Middleware
// -----------------------------
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    
    // Fetch user from database
    const user = await User.findByPk(decoded.id, {
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user is approved (SuperAdmin and Admin bypass pending check)
    if (user.role !== 'SuperAdmin' && user.role !== 'Admin' && user.status !== 'Approved') {
      return res.status(403).json({
        success: false,
        message: user.status === 'Pending'
          ? "Account pending approval. Please wait for admin approval."
          : "Account has been rejected. Contact support for assistance.",
        status: user.status,
      });
    }

    // Set user info on request object
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      status: user.status,
      userTypeId: user.userTypeId,
      userTypeName: user.userType?.name,
      company: user.company
    };
    req.token = token;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};

// -----------------------------
// Role Authorization Middleware
// -----------------------------
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const userRole = req.user.role;
    
    // SuperAdmin always has access
    if (userRole === 'SuperAdmin') {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied for role ${userRole}`,
        requiredRoles: allowedRoles,
        userRole: userRole
      });
    }
    next();
  };
};

// -----------------------------
// Module-specific Access
// -----------------------------
const moduleAccess = {
  requireAdmin: authorizeRoles(["SuperAdmin", "Admin"]),
  requireManagerOrAdmin: authorizeRoles(["SuperAdmin", "Admin", "Manager"]),
  requireSalesAccess: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Sales"]),
  requireSupportAccess: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Support"]),
  requireBusinessUser: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Dealer", "Architect"]),
  requireAuth: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Sales", "Support", "Dealer", "Architect", "General", "Customer"]),
  requireStaffAccess: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Sales", "Support"])
};

// -----------------------------
// Own Data or Staff Access
// -----------------------------
const requireOwnDataOrStaff = async (req, res, next) => {
  try {
    const userRole = req.user.role;

    // Staff (including SuperAdmin) can access any data
    if (['SuperAdmin', 'Admin', 'Manager', 'Sales', 'Support'].includes(userRole)) {
      return next();
    }

    // Non-staff → must own the enquiry
    const enquiryId = req.params.id;
    if (!enquiryId) {
      return res.status(400).json({
        success: false,
        message: "Missing enquiry ID in request"
      });
    }

    const enquiry = await VideoCallEnquiry.findByPk(enquiryId);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found"
      });
    }

    if (enquiry.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only access your own enquiries"
      });
    }

    // Attach enquiry to request for controller use
    req.enquiry = enquiry;
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Authorization error",
      error: err.message
    });
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  moduleAccess,
  requireOwnDataOrStaff,
};
