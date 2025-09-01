// // middleware/index.js - FIXED VERSION
// const jwt = require('jsonwebtoken');
// require('dotenv').config();

// const authMiddleware = (req, res, next) => {
//   const token = req.header("Authorization")?.replace("Bearer ", "");
  
//   if (!token) {
//     return res.status(401).json({ error: "No token provided" });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
//     console.log('Decoded token:', decoded); // Debug log
    
//     // Ensure req.user has the correct structure
//     req.user = {
//       id: decoded.id,
//       role: decoded.role,
//       email: decoded.email,
//       status: decoded.status,
//       userTypeId: decoded.userTypeId
//     };
    
//     console.log('req.user set to:', req.user); // Debug log
//     next();
//   } catch (err) {
//     console.error('Token verification error:', err);
//     return res.status(401).json({ error: "Invalid token" });
//   }
// };

// module.exports = { authMiddleware };
// middleware/auth.js
const jwt = require('jsonwebtoken');
const { User, UserType } = require('../models');

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    const user = await User.findByPk(decoded.id, {
      include: [{ model: UserType, as: "userType", attributes: ["id", "name"] }],
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      status: user.status,
      userTypeId: user.userTypeId,
      userTypeName: user.userType?.name,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// Role checker
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied for role ${userRole}`,
        requiredRoles: allowedRoles,
      });
    }
    next();
  };
};

// --- Specific Role Middlewares ---
const requireAdmin = authorizeRoles(["Admin"]);
const requireManager = authorizeRoles(["Admin", "Manager"]);
const requireSales = authorizeRoles(["Sales"]);
const requireSupport = authorizeRoles(["Support"]);

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  requireManager,
  requireSales,
  requireSupport,
};
