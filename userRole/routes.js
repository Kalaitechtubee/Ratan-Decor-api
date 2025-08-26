// routes/users.js
const express = require('express');
const router = express.Router();
const userRoleController = require('../userRole/controller'); // Adjust path if needed
const { authMiddleware: authenticateToken, requireRole: authorizeRoles } = require('../middleware');

// All routes require authentication
router.use(authenticateToken);

// ✅ Get all roles
router.get(
  '/roles',
  authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']),
  userRoleController.getAllRoles
);

// ✅ Get users by role/status/search
router.get(
  '/users',
  authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']),
  userRoleController.getUsersByRole
);

// ✅ Update user role / status / userType
router.put(
  '/users/:id/role',
  authorizeRoles(['Admin', 'Manager']),
  userRoleController.updateUserRole
);

// ✅ Update user status (Pending → Approved/Rejected)
router.put(
  '/users/:id/status',
  authorizeRoles(['Admin', 'Manager']),
  userRoleController.updateUserStatus
);

// ✅ Get role stats
router.get(
  '/stats',
  authorizeRoles(['Admin', 'Manager']),
  userRoleController.getRoleStats
);

module.exports = router;