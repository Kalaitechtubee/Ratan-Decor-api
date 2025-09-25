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

    // Check if user is approved (except for Admins and SuperAdmin)
    const userRoleLower = user.role.toLowerCase();
    if (userRoleLower !== 'admin' && userRoleLower !== 'superadmin' && user.status !== 'Approved') {
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

    const userRole = req.user.role.toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());
    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied for role ${req.user.role}`,
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }
    next();
  };
};

// Module-specific access control based on your requirements
const moduleAccess = {
  // Admin: Full control over everything
  requireAdmin: authorizeRoles(["superadmin", "admin"]),

  // Manager: Can approve/reject, manage roles, view stats
  requireManagerOrAdmin: authorizeRoles(["superadmin", "admin", "manager"]),

  // Sales: Access to Enquiries + Orders modules only
  requireSalesAccess: authorizeRoles(["superadmin", "admin", "manager", "sales"]),

  // Support: Access to Products module only
  requireSupportAccess: authorizeRoles(["superadmin", "admin", "manager", "support"]),

  // Business users: Limited access to own data
  requireBusinessUser: authorizeRoles(["superadmin", "admin", "manager", "dealer", "architect"]),

  // Any authenticated user
  requireAuth: authorizeRoles(["superadmin", "admin", "manager", "sales", "support", "dealer", "architect", "general", "customer"]),

  // Staff roles (internal users)
  requireStaffAccess: authorizeRoles(["superadmin", "admin", "manager", "sales", "support"])
};

// Data access control middleware
const requireOwnDataOrStaff = (req, res, next) => {
  const userRole = req.user.role.toLowerCase();
  const requestedUserId = req.params.userId || req.params.id;

  // Staff can access any data
  if (['admin', 'manager', 'sales', 'support'].includes(userRole)) {
    return next();
  }

  // Customers can access only their own data
  if (userRole === 'customer') {
    if (requestedUserId && parseInt(requestedUserId) !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Customers can only access their own data"
      });
    }
    return next();
  }

  // Other roles: restrict access if not own data
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