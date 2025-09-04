// admin/router.js
const express = require('express');
const router = express.Router();
const {
  getPendingUsers,
  getAllUsers,
  approveUser,
  getUserStats,
  updateUserRole,
} = require('./controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');

// All admin routes require authentication
router.use(authenticateToken);

// User management routes with proper role restrictions
router.get('/users/pending', moduleAccess.requireAdmin, getPendingUsers);
router.get('/users', moduleAccess.requireAdmin, getAllUsers);
router.put('/users/:userId/approve', moduleAccess.requireAdmin, approveUser);
router.put('/users/:userId/role', moduleAccess.requireAdmin, updateUserRole);
router.get('/stats', moduleAccess.requireAdmin, getUserStats);

module.exports = router;