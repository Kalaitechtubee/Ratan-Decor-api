// const jwt = require('jsonwebtoken');
// const { User, UserType } = require('../models');

// const authenticateToken = async (req, res, next) => {
//   try {
//     const authHeader = req.header("Authorization");
//     const token = authHeader && authHeader.startsWith("Bearer ")
//       ? authHeader.replace("Bearer ", "")
//       : null;

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Access denied. No token provided.",
//       });
//     }

//     // Verify token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
//     const userId = decoded.id || decoded.sub || decoded.userId;
//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid token. No user ID found.",
//       });
//     }

//     // Fetch user + role from DB
//     const user = await User.findByPk(userId, {
//       include: [
//         {
//           model: UserType,
//           as: "userType",
//           attributes: ["id", "name", "isActive"],
//         },
//       ],
//     });

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid token. User not found.",
//       });
//     }

//     // Default role if missing
//     const role = (user.role || "User").toLowerCase();

//     // Check approval for non-admin users
//     if (role !== "admin" && user.status !== "Approved") {
//       return res.status(403).json({
//         success: false,
//         message: "Account not approved. Please wait for admin approval.",
//         status: user.status,
//       });
//     }

//     // Attach user info to request
//     req.user = {
//       userId: user.id,
//       role, // ✅ always lowercase
//       email: user.email,
//       name: user.name,
//       userTypeId: user.userTypeId,
//       userTypeName: user.userType?.name || "General",
//       status: user.status,
//     };

//     req.token = token;
//     next();
//   } catch (error) {
//     if (error.name === "TokenExpiredError") {
//       return res.status(401).json({
//         success: false,
//         message: "Token expired. Please login again.",
//       });
//     }

//     return res.status(401).json({
//       success: false,
//       message: "Authentication failed: " + error.message,
//     });
//   }
// };

// // ✅ Role authorization
// const authorizeRoles = (allowedRoles) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).json({
//         success: false,
//         message: "Authentication required.",
//       });
//     }

//     const userRole = req.user.role.toLowerCase();
//     const allowed = allowedRoles.map((r) => r.toLowerCase());

//     if (!allowed.includes(userRole)) {
//       return res.status(403).json({
//         success: false,
//         message: "Access denied. Insufficient permissions.",
//         requiredRoles: allowed,
//         userRole,
//       });
//     }

//     next();
//   };
// };

// // Convenience middlewares
// const requireAdmin = authorizeRoles(['Admin']);
// const requireManagerOrAdmin = authorizeRoles(['Admin', 'Manager']);
// const requireApprovedRole = authorizeRoles(['Admin', 'Manager', 'Sales', 'Support', 'Architect', 'Dealer']);

// module.exports = {
//   authenticateToken,
//   authorizeRoles,
//   requireAdmin,
//   requireManagerOrAdmin,
//   requireApprovedRole,
// };
const jwt = require('jsonwebtoken');
const { User, UserType } = require('../models');

const authenticateToken = async (req, res, next) => {
  try {
    console.log('🔐 AUTH MIDDLEWARE - START');
    console.log('   Path:', req.path);
    console.log('   Method:', req.method);

    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      console.log('🔐 No token provided');
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    console.log('🔐 Token decoded:', { id: decoded.id, role: decoded.role });
    
    const userId = decoded.id || decoded.sub || decoded.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. No user ID found.",
      });
    }

    // Fetch user + role from DB
    const user = await User.findByPk(userId, {
      include: [
        {
          model: UserType,
          as: "userType",
          attributes: ["id", "name", "isActive"],
        },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
    }

    // Default role if missing - KEEP ORIGINAL CASE
    const role = user.role || "User";

    // Check approval for non-admin users
    if (role.toLowerCase() !== "admin" && user.status !== "Approved") {
      return res.status(403).json({
        success: false,
        message: "Account not approved. Please wait for admin approval.",
        status: user.status,
      });
    }

    // ✅ CRITICAL FIX: Ensure req.user.id is set properly
    req.user = {
      id: user.id,              // ✅ PRIMARY: Order controller uses req.user.id  
      userId: user.id,          // ✅ Backup field for compatibility
      role: role,               // ✅ Keep original case (Admin, not admin)
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      userTypeId: user.userTypeId,
      userTypeName: user.userType?.name || "General",
      status: user.status,
    };

    // ✅ DEBUGGING: Log what we're setting
    console.log('🔐 Setting req.user:', {
      id: req.user.id,
      userId: req.user.userId, 
      role: req.user.role,
      hasValidId: !!req.user.id && typeof req.user.id === 'number'
    });

    console.log('🔐 User authenticated:', { 
      id: req.user.id, 
      role: req.user.role,
      hasId: !!req.user.id 
    });
    
    req.token = token;
    next();
  } catch (error) {
    console.error('🔐 Auth error:', error.message);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed: " + error.message,
    });
  }
};

// Role authorization
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const userRole = req.user.role.toLowerCase();
    const allowed = allowedRoles.map((r) => r.toLowerCase());

    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
        requiredRoles: allowed,
        userRole,
      });
    }

    next();
  };
};

// Convenience middlewares
const requireAdmin = authorizeRoles(['Admin']);
const requireManagerOrAdmin = authorizeRoles(['Admin', 'Manager']);
const requireApprovedRole = authorizeRoles(['Admin', 'Manager', 'Sales', 'Support', 'Architect', 'Dealer']);

// Legacy middleware for backward compatibility
const authMiddleware = authenticateToken;
const requireRole = authorizeRoles;

module.exports = {
  authenticateToken,
  authMiddleware,           // ✅ Legacy alias
  authorizeRoles,
  requireRole,             // ✅ Legacy alias
  requireAdmin,
  requireManagerOrAdmin,
  requireApprovedRole,
};