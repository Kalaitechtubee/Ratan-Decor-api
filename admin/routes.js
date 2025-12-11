// admin/router.js (updated: aligned with moduleAccess.requireAdmin, added consistent middleware)
const express = require('express');
const router = express.Router();
const {
  getPendingUsers,
  getAllUsers,
  approveUser,
  getUserStats,
  updateUserRole,
  getDashboardStats,
} = require('./controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits, secureLogout } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.admin);

// User management routes with proper role restrictions (SuperAdmin/Admin only)
router.get('/users/pending', moduleAccess.requireAdmin, auditLogger, getPendingUsers);
router.get('/users', moduleAccess.requireAdmin, auditLogger, getAllUsers);
router.put('/users/:userId/approve', moduleAccess.requireAdmin, auditLogger, approveUser);
router.put('/users/:userId/role', moduleAccess.requireAdmin, auditLogger, updateUserRole);
router.get('/stats', moduleAccess.requireAdmin, auditLogger, getUserStats);
router.get('/dashboard', moduleAccess.requireAdmin, auditLogger, getDashboardStats);

// Admin logout route
router.post('/logout', secureLogout);

// Error handling
router.use((error, req, res, next) => {
  console.error('Admin route error:', error);
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