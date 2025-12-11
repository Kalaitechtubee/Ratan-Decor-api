// middleware/auth.js (corrected: fixed role consistency, normalized roles in status checks, extracted user loading helper, removed JWT secret fallback, added ID validation in requireOwnDataOrStaff, improved logging)
const jwt = require('jsonwebtoken');
const { User, UserType, VideoCallEnquiry } = require('../models');
const { verifyAccessToken, verifyRefreshToken } = require('../services/jwt.service');
const { getCookieOptions } = require('./cookieOptions');
const { sessionSecurity } = require('./security');

// -----------------------------
// Helper: Load and Set User (deduplicated logic)
// -----------------------------
const loadAndSetUser = async (req, res, userId) => {
  try {
    const user = await User.findByPk(userId, {
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
    });

    if (!user) {
      return { error: { status: 401, message: 'User not found' } };
    }

    // Check if user is approved (SuperAdmin and Admin bypass pending check)
    if (user.role !== 'SuperAdmin' && user.role !== 'Admin' && user.status !== 'Approved') {
      const message = user.status === 'Pending'
        ? 'Account pending approval. Please wait for admin approval.'
        : 'Account has been rejected. Contact support for assistance.';
      return { error: { status: 403, message, status: user.status } };
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

    return { user };
  } catch (err) {
    console.error('User loading error:', { message: err.message, userId });
    return { error: { status: 500, message: 'Failed to load user' } };
  }
};

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
   
    const respondError = (status, message) => res.status(status).json({ success: false, message });
   
    // Validate JWT secret
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is required');
      return respondError(500, 'Server configuration error');
    }
   
    // Try access token first
    if (accessToken && !sessionSecurity.isTokenBlacklisted(accessToken)) {
      try {
        const decoded = verifyAccessToken(accessToken);
        const result = await loadAndSetUser(req, res, decoded.id);
        if (result.error) {
          return respondError(result.error.status, result.error.message);
        }
        req.token = accessToken;
        return next();
      } catch (err) {
        // fall through to refresh
        console.error('Access token verification failed:', { message: err.message });
      }
    }
   
    // Access token missing/invalid/expired -> try refresh token
    if (refreshToken && !sessionSecurity.isRefreshBlacklisted(refreshToken)) {
      try {
        const decodedRefresh = verifyRefreshToken(refreshToken);
        const result = await loadAndSetUser(req, res, decodedRefresh.id);
        if (result.error) {
          return respondError(result.error.status, result.error.message);
        }

        const newAccessToken = jwt.sign({
          id: result.user.id,
          role: result.user.role,
          status: result.user.status,
          email: result.user.email,
          userTypeId: result.user.userTypeId
        }, secret, { expiresIn: '15m' });
       
        setAccessCookie(newAccessToken);
        req.token = newAccessToken;
        return next();
      } catch (err) {
        console.error('Refresh token verification failed:', { message: err.message });
        return respondError(401, 'Invalid refresh token');
      }
    }
   
    return respondError(401, 'Access denied. No valid token provided.');
  } catch (err) {
    console.error('Auth middleware error:', { message: err.message, userId: req.user?.id });
    return res.status(401).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

// -----------------------------
// Role Authorization Middleware
// -----------------------------
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Flatten the allowedRoles array in case it's nested
      const roles = Array.isArray(allowedRoles[0]) ? allowedRoles[0] : allowedRoles;
     
      // If no specific roles are required, just continue
      if (!roles || roles.length === 0) {
        return next();
      }
      // Get user from request (should be set by authenticateToken)
      if (!req.user || !req.user.role) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }
      // SuperAdmin has access to everything
      if (req.user.role === 'SuperAdmin') {
        return next();
      }
      // Check if user has required role
      const hasRole = roles.includes(req.user.role);
      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Your role (${req.user.role}) does not have permission.`,
          requiredRoles: roles,
          userRole: req.user.role,
        });
      }
      next();
    } catch (error) {
      console.error('Authorization error:', {
        message: error.message,
        userRole: req.user?.role,
        allowedRoles: allowedRoles
      });
      return res.status(500).json({
        success: false,
        message: 'An error occurred during authorization',
      });
    }
  };
};

// -----------------------------
// Module-specific Access (updated to match exact table permissions)
// -----------------------------
const moduleAccess = {
  // Dashboard: SuperAdmin, Admin, Support, Sales
  requireDashboardAccess: authorizeRoles(["SuperAdmin", "Admin", "Support", "Sales"]),
 
  // Orders: SuperAdmin, Admin, Sales
  requireOrdersAccess: authorizeRoles(["SuperAdmin", "Admin", "Sales"]),
 
  // Enquiries: SuperAdmin, Admin, Sales
  requireEnquiriesAccess: authorizeRoles(["SuperAdmin", "Admin", "Sales"]),
 
  // Customers: SuperAdmin, Admin, Sales (using consistent casing)
  requireCustomersAccess: authorizeRoles(["SuperAdmin", "Admin", "Sales"]),
 
  // Products: SuperAdmin, Admin, Support
  requireProductsAccess: authorizeRoles(["SuperAdmin", "Admin", "Support"]),
 
  // Staff Management: SuperAdmin, Admin
  requireStaffManagementAccess: authorizeRoles(["SuperAdmin", "Admin"]),
 
  // Business Types: SuperAdmin, Admin, Support
  requireBusinessTypesAccess: authorizeRoles(["SuperAdmin", "Admin", "Support"]),
 
  // Categories: SuperAdmin, Admin, Support
  requireCategoriesAccess: authorizeRoles(["SuperAdmin", "Admin", "Support"]),
 
  // Sliders: SuperAdmin, Admin, Support
  requireSlidersAccess: authorizeRoles(["SuperAdmin", "Admin", "Support"]),
 
  // SEO: SuperAdmin, Admin, Support
  requireSeoAccess: authorizeRoles(["SuperAdmin", "Admin", "Support"]),
 
  // Contacts: SuperAdmin, Admin, Support, Sales
  requireContactsAccess: authorizeRoles(["SuperAdmin", "Admin", "Support", "Sales"]),
 
  // Legacy/Adjusted existing (removed Manager where not in table, adjusted for table alignment)
  requireAdmin: authorizeRoles(["SuperAdmin", "Admin"]),
  requireManagerOrAdmin: authorizeRoles(["SuperAdmin", "Admin"]), // Removed Manager as not in table
  requireSalesAccess: authorizeRoles(["SuperAdmin", "Admin", "Sales"]), // Removed Manager
  requireSupportAccess: authorizeRoles(["SuperAdmin", "Admin", "Support"]), // Removed Manager
  requireBusinessUser: authorizeRoles(["SuperAdmin", "Admin", "Support"]), // Adjusted to match Business Types/Support
  requireAuth: authorizeRoles(["SuperAdmin", "Admin", "Support", "Sales"]), // Limited to table roles
  requireStaffAccess: authorizeRoles(["SuperAdmin", "Admin"]) // Limited to Staff Management
};

// -----------------------------
// Own Data or Staff Access (added ID validation)
// -----------------------------
const requireOwnDataOrStaff = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    // Staff (SuperAdmin, Admin, Sales, Support) can access any data
    if (['SuperAdmin', 'Admin', 'Sales', 'Support'].includes(userRole)) {
      return next();
    }
   
    // Non-staff → must own the enquiry
    const enquiryIdParam = req.params.id;
    if (!enquiryIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Missing enquiry ID in request'
      });
    }

    const enquiryId = parseInt(enquiryIdParam, 10);
    if (isNaN(enquiryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid enquiry ID'
      });
    }
   
    const enquiry = await VideoCallEnquiry.findByPk(enquiryId);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }
   
    if (enquiry.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own enquiries'
      });
    }
   
    // Attach enquiry to request for controller use
    req.enquiry = enquiry;
    next();
  } catch (err) {
    console.error('Own data auth error:', { message: err.message, userRole: req.user?.role });
    return res.status(500).json({
      success: false,
      message: 'Authorization error',
    });
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  moduleAccess,
  requireOwnDataOrStaff,
};