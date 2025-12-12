// routes/userRole.js (clean version: removed all role-based access)
const express = require('express');
const router = express.Router();

const userRoleController = require('../userRole/controller');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.general);

// ===============================
// Public (Authenticated) Endpoints
// ===============================

router.get('/', auditLogger, userRoleController.getAllRoles);

router.get('/users', auditLogger, userRoleController.getUsersByRole);

router.put('/users/:id/role', auditLogger, userRoleController.updateUserRole);

router.put('/users/:id/status', auditLogger, userRoleController.updateUserStatus);

router.get('/stats', auditLogger, userRoleController.getRoleStats);

// ===============================
// Error Handling
// ===============================
router.use((error, req, res, next) => {
  console.error('UserRole route error:', error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;
