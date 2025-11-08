
const express = require('express');
const router = express.Router();
const userRoleController = require('../userRole/controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');


router.use(authenticateToken);

router.get('/', 
 
  userRoleController.getAllRoles
);

router.get('/users', 
  moduleAccess.requireStaffAccess, 
  userRoleController.getUsersByRole
);


router.put('/users/:id/role', 

  userRoleController.updateUserRole
);

router.put('/users/:id/status', 
  moduleAccess.requireManagerOrAdmin, 
  userRoleController.updateUserStatus
);


router.get('/stats', 
  moduleAccess.requireManagerOrAdmin, 
  userRoleController.getRoleStats
);

module.exports = router;
