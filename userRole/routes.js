// routes/userRoles.js - User Role Management
const express = require('express');
const router = express.Router();
const userRoleController = require('../userRole/controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get all roles (Admin, Manager, Sales, Support can view)
router.get('/', 
 
  userRoleController.getAllRoles
);

// Get users by role/status/search (Admin, Manager, Sales, Support can view)
router.get('/users', 
  moduleAccess.requireStaffAccess, 
  userRoleController.getUsersByRole
);

// Update user role/userType (Admin, Manager only)
router.put('/users/:id/role', 

  userRoleController.updateUserRole
);

// Update user status (Admin, Manager only)
router.put('/users/:id/status', 
  moduleAccess.requireManagerOrAdmin, 
  userRoleController.updateUserStatus
);

// Get role statistics (Admin, Manager only)
router.get('/stats', 
  moduleAccess.requireManagerOrAdmin, 
  userRoleController.getRoleStats
);

module.exports = router;
