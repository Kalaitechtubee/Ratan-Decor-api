const jwt = require('jsonwebtoken');
const { User, UserType } = require('../models');
const { generateAccessToken, verifyAccessToken, verifyRefreshToken } = require('../services/jwt.service');
const { sessionSecurity } = require('../middleware/security');


const fetchUserWithType = async (userId) => {
  return await User.findByPk(userId, {
    include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
  });
};


const isUserApproved = (user) => {
  // SuperAdmin and Admin bypass pending check
  if (user.role === 'SuperAdmin' || user.role === 'Admin') {
    return true;
  }
  // Other roles must be Approved
  return user.status === 'Approved';
};

const buildUserInfo = (user) => {
  return {
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
};


const getApprovalMessage = (status) => {
  return status === 'Pending'
    ? "Account pending approval. Please wait for admin approval."
    : "Account has been rejected. Contact support for assistance.";
};


const authenticateToken = async (req, res, next) => {
  try {
    // Read access token from cookie (preferred) or Authorization header (backward compat)
    const accessTokenFromCookie = req.cookies.accessToken;
    const authHeader = req.header("Authorization");
    const accessTokenFromHeader = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;
    
    // Prefer cookie over header, but allow header for backward compatibility
    const accessToken = accessTokenFromCookie || accessTokenFromHeader;

    const refreshToken = req.cookies.refreshToken;

    // ========== CASE 1: No access token ==========
    if (!accessToken) {

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Access denied. No tokens provided.",
        });
      }

        try {

          if (sessionSecurity.isRefreshBlacklisted(refreshToken)) {
            return res.status(401).json({
              success: false,
              message: 'Invalid refresh token'
            });
          }

          const decodedRefresh = verifyRefreshToken(refreshToken);
        const user = await fetchUserWithType(decodedRefresh.id);

        if (!user) {
          return res.status(401).json({
            success: false,
            message: "User not found"
          });
        }

        if (!isUserApproved(user)) {
          return res.status(403).json({
            success: false,
            message: getApprovalMessage(user.status),
            status: user.status,
          });
        }

        const newAccessToken = generateAccessToken({
          id: user.id,
          role: user.role,
          status: user.status,
          email: user.email,
          userTypeId: user.userTypeId
        });

        // Set new access token in httpOnly cookie
        res.cookie('accessToken', newAccessToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'None',
          maxAge: 15 * 60 * 1000 // 15 minutes
        });

        req.user = buildUserInfo(user);
        req.token = newAccessToken;

        // Keep header for backward compatibility during migration
        res.setHeader('X-New-Access-Token', newAccessToken);
        

        return next();

      } catch (refreshError) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token"
        });
      }
    }

    try {

      if (sessionSecurity.isTokenBlacklisted(accessToken)) {
        return res.status(401).json({ success: false, message: 'Invalid access token' });
      }

      const decoded = verifyAccessToken(accessToken);
      const user = await fetchUserWithType(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }


      if (!isUserApproved(user)) {
        return res.status(403).json({
          success: false,
          message: getApprovalMessage(user.status),
          status: user.status,
        });
      }

   
      req.user = buildUserInfo(user);
      req.token = accessToken;
      return next();

    } catch (accessError) {

      if (refreshToken) {
        try {
          if (sessionSecurity.isRefreshBlacklisted(refreshToken)) {
            return res.status(401).json({
              success: false,
              message: 'Invalid refresh token'
            });
          }

          const decodedRefresh = verifyRefreshToken(refreshToken);
          const user = await fetchUserWithType(decodedRefresh.id);

          if (!user) {
            return res.status(401).json({
              success: false,
              message: "User not found"
            });
          }


          if (!isUserApproved(user)) {
            return res.status(403).json({
              success: false,
              message: getApprovalMessage(user.status),
              status: user.status,
            });
          }


          const newAccessToken = generateAccessToken({
            id: user.id,
            role: user.role,
            status: user.status,
            email: user.email,
            userTypeId: user.userTypeId
          });

          // Set new access token in httpOnly cookie
          res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 15 * 60 * 1000 // 15 minutes
          });

          req.user = buildUserInfo(user);
          req.token = newAccessToken;

          // Keep header for backward compatibility during migration
          res.setHeader('X-New-Access-Token', newAccessToken);

          return next();

        } catch (refreshError) {
          return res.status(401).json({
            success: false,
            message: "Invalid refresh token"
          });
        }
      } else {

        return res.status(401).json({
          success: false,
          message: "Invalid access token and no refresh token provided"
        });
      }
    }

  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Authentication error",
      error: err.message
    });
  }
};

const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const userRole = req.user.role;


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

const moduleAccess = {
  requireAdmin: authorizeRoles(["SuperAdmin", "Admin"]),
  requireManagerOrAdmin: authorizeRoles(["SuperAdmin", "Admin", "Manager"]),
  requireSalesAccess: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Sales"]),
  requireSupportAccess: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Support"]),
  requireBusinessUser: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Dealer", "Architect"]),
  requireAuth: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Sales", "Support", "Dealer", "Architect", "General", "Customer"]),
  requireStaffAccess: authorizeRoles(["SuperAdmin", "Admin", "Manager", "Sales", "Support"])
};


const requireOwnDataOrStaff = async (req, res, next) => {
  try {
    const userRole = req.user.role;


    if (['SuperAdmin', 'Admin', 'Manager', 'Sales', 'Support'].includes(userRole)) {
      return next();
    }

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
  authMiddleware: authenticateToken,
  authorizeRoles,
  requireRole: authorizeRoles, 
  moduleAccess,
  requireOwnDataOrStaff,
};
