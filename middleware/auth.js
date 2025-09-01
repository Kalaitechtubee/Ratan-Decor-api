// middleware/auth.js - Consolidated Authentication & Authorization
const jwt = require('jsonwebtoken');
const { User, UserType } = require('../models');

// Main authentication middleware
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
    
    // Fetch user from database to ensure current data
    const user = await User.findByPk(decoded.id, {
      include: [{ model: UserType, as: "userType", attributes: ["id", "name"] }],
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Check if user is approved (except for Admins)
    if (user.role !== 'Admin' && user.status !== 'Approved') {
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

// Role authorization middleware factory
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    const userRole = req.user.role;
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

// Module-specific access control based on your requirements
const moduleAccess = {
  // Admin: Full control over everything
  requireAdmin: authorizeRoles(["Admin"]),
  
  // Manager: Can approve/reject, manage roles, view stats
  requireManagerOrAdmin: authorizeRoles(["Admin", "Manager"]),
  
  // Sales: Access to Enquiries + Orders modules only
  requireSalesAccess: authorizeRoles(["Admin", "Manager", "Sales"]),
  
  // Support: Access to Products module only
  requireSupportAccess: authorizeRoles(["Admin", "Manager", "Support"]),
  
  // Business users: Limited access to own data
  requireBusinessUser: authorizeRoles(["Admin", "Manager", "Dealer", "Architect"]),
  
  // Any authenticated user
  requireAuth: authorizeRoles(["Admin", "Manager", "Sales", "Support", "Dealer", "Architect", "General", "Customer"]),
  
  // Staff roles (internal users)
  requireStaffAccess: authorizeRoles(["Admin", "Manager", "Sales", "Support"])
};

// Data access control middleware
const requireOwnDataOrStaff = (req, res, next) => {
  const userRole = req.user.role;
  const requestedUserId = req.params.userId || req.params.id;
  
  // Staff can access any data
  if (['Admin', 'Manager', 'Sales', 'Support'].includes(userRole)) {
    return next();
  }
  
  // Non-staff can only access their own data
  if (requestedUserId && parseInt(requestedUserId) !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "You can only access your own data"
    });
  }
  
  next();
};

// Legacy aliases for backward compatibility
const authMiddleware = authenticateToken;
const requireRole = authorizeRoles;

module.exports = {
  authenticateToken,
  authMiddleware, // Legacy alias
  authorizeRoles,
  requireRole, // Legacy alias
  moduleAccess,
  requireOwnDataOrStaff,
  
  // Individual role requirements
  requireAdmin: moduleAccess.requireAdmin,
  requireManager: moduleAccess.requireManagerOrAdmin,
  requireSales: moduleAccess.requireSalesAccess,
  requireSupport: moduleAccess.requireSupportAccess,
};