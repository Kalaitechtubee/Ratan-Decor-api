const express = require('express');
const router = express.Router();
const userRoleController = require('./controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/users', authorizeRoles(['Admin', 'Manager', 'Sales', 'Support']), userRoleController.getUsersByRole);
router.put('/users/:id/role', authorizeRoles(['Admin', 'Manager']), userRoleController.updateUserRole);
router.put('/users/:id/status', authorizeRoles(['Admin', 'Manager']), userRoleController.updateUserStatus);
router.get('/stats', authorizeRoles(['Admin', 'Manager']), userRoleController.getRoleStats);

module.exports = router;