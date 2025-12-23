// middleware/auth.js (updated: removed role-based checks in moduleAccess – now all pass-through for authenticated users only)
const jwt = require('jsonwebtoken');
const { User, UserType, VideoCallEnquiry } = require('../models');
const { generateAccessToken, verifyAccessToken, verifyRefreshToken } = require('../services/jwt.service');
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

    return { user: req.user }; // Return the payload object for consistency
  } catch (err) {
    console.error('User loading error:', { message: err.message, userId });
    return { error: { status: 500, message: 'Failed to load user' } };
  }
};

// -----------------------------
// Helper: Get cookie names based on client type (admin vs customer)
// -----------------------------
const getCookieNames = (req) => {
  const clientType = req.headers['x-client-type'] || req.query.clientType || '';
  const isAdmin = clientType.toLowerCase() === 'admin';
  return {
    accessToken: isAdmin ? 'admin_accessToken' : 'accessToken',
    refreshToken: isAdmin ? 'admin_refreshToken' : 'refreshToken',
    isAdmin
  };
};

// -----------------------------
// Authentication Middleware (Optional - no 401 on failure)
// -----------------------------
const authenticateTokenOptional = async (req, res, next) => {
  try {
    const cookieNames = getCookieNames(req);
    const accessToken = req.cookies[cookieNames.accessToken];
    const refreshToken = req.cookies[cookieNames.refreshToken];

    const setAccessCookie = (token) => {
      res.cookie(cookieNames.accessToken, token, getCookieOptions(15 * 60 * 1000));
      res.setHeader('X-New-Access-Token', token);
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) return next();

    // Try access token
    if (accessToken && !sessionSecurity.isTokenBlacklisted(accessToken)) {
      try {
        const decoded = verifyAccessToken(accessToken);
        const result = await loadAndSetUser(req, res, decoded.id);
        if (!result.error) {
          req.token = accessToken;
          return next();
        }
      } catch (err) { }
    }

    // Try refresh token
    if (refreshToken && !sessionSecurity.isRefreshBlacklisted(refreshToken)) {
      try {
        const decodedRefresh = verifyRefreshToken(refreshToken);
        const result = await loadAndSetUser(req, res, decodedRefresh.id);
        if (!result.error) {
          const newAccessToken = generateAccessToken(result.user);
          setAccessCookie(newAccessToken);
          req.token = newAccessToken;
          return next();
        }
      } catch (err) { }
    }

    // No valid token found, just continue properly as guest
    next();
  } catch (err) {
    // If error occurs, just treat as guest
    next();
  }
};

// -----------------------------
// Authentication Middleware (Cookie-based with client type support)
// -----------------------------
const authenticateToken = async (req, res, next) => {
  try {
    const cookieNames = getCookieNames(req);
    const accessToken = req.cookies[cookieNames.accessToken];
    const refreshToken = req.cookies[cookieNames.refreshToken];

    const setAccessCookie = (token) => {
      res.cookie(cookieNames.accessToken, token, getCookieOptions(15 * 60 * 1000));
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

        // Use generateAccessToken for consistency
        const newAccessToken = generateAccessToken(result.user);

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
// Module-specific Access (removed role checks – all pass-through for authenticated users)
// -----------------------------
const moduleAccess = {
  // Dashboard: Pass-through
  requireDashboardAccess: (req, res, next) => next(),

  // Orders: Pass-through
  requireOrdersAccess: (req, res, next) => next(),

  // Enquiries: Pass-through
  requireEnquiriesAccess: (req, res, next) => next(),

  // Customers: Pass-through
  requireCustomersAccess: (req, res, next) => next(),

  // Products: Pass-through
  requireProductsAccess: (req, res, next) => next(),

  // Staff Management: Pass-through
  requireStaffManagementAccess: (req, res, next) => next(),

  // Business Types: Pass-through
  requireBusinessTypesAccess: (req, res, next) => next(),

  // Categories: Pass-through
  requireCategoriesAccess: (req, res, next) => next(),

  // Sliders: Pass-through
  requireSlidersAccess: (req, res, next) => next(),

  // SEO: Pass-through
  requireSeoAccess: (req, res, next) => next(),

  // Contacts: Pass-through
  requireContactsAccess: (req, res, next) => next(),

  // Legacy/Adjusted (all pass-through)
  requireAdmin: (req, res, next) => next(),
  requireManagerOrAdmin: (req, res, next) => next(),
  requireSalesAccess: (req, res, next) => next(),
  requireSupportAccess: (req, res, next) => next(),
  requireBusinessUser: (req, res, next) => next(),
  requireAuth: (req, res, next) => next(),
  requireStaffAccess: (req, res, next) => next()
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
  authenticateTokenOptional,
  authorizeRoles,
  moduleAccess,
  requireOwnDataOrStaff,
};