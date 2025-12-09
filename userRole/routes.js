// routes/userRole.js - Updated without express-validator
const express = require('express');
const router = express.Router();
const userRoleController = require('../userRole/controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { sanitizeInput, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.general);

router.get('/', userRoleController.getAllRoles);

router.get('/users', 
  moduleAccess.requireStaffAccess, // SuperAdmin/Admin included
  userRoleController.getUsersByRole
);

router.put('/users/:id/role', 
  moduleAccess.requireStaffAccess, // SuperAdmin/Admin included
  userRoleController.updateUserRole
);

router.put('/users/:id/status', 
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  userRoleController.updateUserStatus
);

router.get('/stats', 
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  userRoleController.getRoleStats
);

module.exports = router;