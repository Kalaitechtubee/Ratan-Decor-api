// middleware/auth.js
const jwt = require('jsonwebtoken');
const { User, UserType } = require('../models');
const { verifyAccessToken, verifyRefreshToken } = require('../services/jwt.service');
const { getCookieOptions } = require('./cookieOptions');
const { sessionSecurity } = require('./security');

// -----------------------------
// Authentication Middleware (Cookie-based)
// -----------------------------
const authenticateToken = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    
    const setAccessCookie = (token) => {
      res.cookie('accessToken', token, getCookieOptions(15 * 60 * 1000));
      // Header kept for backward compatibility during migration
      res.setHeader('X-New-Access-Token', token);
    };
    
    const respond401 = (message) => res.status(401).json({ success: false, message });
    
    // Try access token first
    if (accessToken && !sessionSecurity.isTokenBlacklisted(accessToken)) {
      try {
        const decoded = verifyAccessToken(accessToken);
        const user = await User.findByPk(decoded.id, {
          include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
        });
        
        if (!user) return respond401("User not found");
        
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
        req.token = accessToken;
        return next();
      } catch (err) {
        // fall through to refresh
      }
    }
    
    // Access token missing/invalid/expired -> try refresh token
    if (refreshToken && !sessionSecurity.isRefreshBlacklisted(refreshToken)) {
      try {
        const decodedRefresh = verifyRefreshToken(refreshToken);
        const user = await User.findByPk(decodedRefresh.id, {
          include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
        });
        
        if (!user) return respond401("User not found");
        
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
        
        const newAccessToken = jwt.sign({
          id: user.id,
          role: user.role,
          status: user.status,
          email: user.email,
          userTypeId: user.userTypeId
        }, process.env.JWT_SECRET || "secret", { expiresIn: '15m' });
        
        setAccessCookie(newAccessToken);
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
        req.token = newAccessToken;
        return next();
      } catch (err) {
        return respond401("Invalid refresh token");
      }
    }
    
    return respond401("Access denied. No valid token provided.");
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({
      success: false,
      message: "Authentication error",
      error: err.message,
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
  requireAuth: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Sales", "Support", "Dealer", "Architect", "General", "customer"]),
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
    console.error('Own data auth error:', err);
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