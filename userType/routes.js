const express = require('express');
const router = express.Router();
const userTypeController = require('./controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { sanitizeInput, auditLogger } = require('../middleware/security');

/* -------------------------------
   PUBLIC ROUTES
--------------------------------*/
// Anyone can view user types
router.get('/', userTypeController.getAllUserTypes);
router.get('/:id', userTypeController.getUserTypeById);

/* -------------------------------
   PROTECTED ROUTES (Admin/Manager/SuperAdmin)
--------------------------------*/

// Create user type (Admin, Manager, SuperAdmin)
router.post('/',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireManagerOrAdmin,
  auditLogger,
  userTypeController.createUserType
);

// Update user type (Admin, Manager, SuperAdmin)
router.put('/:id',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireManagerOrAdmin,
  auditLogger,
  userTypeController.updateUserType
);

// Delete user type (Admin + SuperAdmin only)
router.delete('/:id',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireAdmin,
  auditLogger,
  userTypeController.deleteUserType
);

module.exports = router;
