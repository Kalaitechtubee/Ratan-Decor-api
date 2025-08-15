const express = require('express');
const router = express.Router();
const userRoleController = require('./controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get users by role (Admin/Manager/Sales/Support)
router.get('/users', authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']), userRoleController.getUsersByRole);

// Update user role (Admin/Manager only)
router.put('/users/:id/role', authorizeRoles(['Admin', 'Manager']), userRoleController.updateUserRole);

// Update user status (Admin/Manager only)
router.put('/users/:id/status', authorizeRoles(['Admin', 'Manager']), userRoleController.updateUserStatus);

// Get role statistics (Admin/Manager only)
router.get('/stats', authorizeRoles(['Admin', 'Manager']), userRoleController.getRoleStats);

module.exports = router;
