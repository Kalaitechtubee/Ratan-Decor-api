const express = require('express');
const router = express.Router();
const {
  getPendingUsers,
  getAllUsers,
  approveUser,
  getUserStats,
  updateUserRole,
} = require('./controller'); // Removed deleteUser from import
const { authenticateToken, moduleAccess } = require('../middleware/auth');

// All admin routes require authentication
router.use(authenticateToken);

// User management routes with proper role restrictions

// Get pending users (Admin and SuperAdmin only)
router.get('/users/pending', moduleAccess.requireAdmin, getPendingUsers);

// Get all users (Admin and SuperAdmin only)
router.get('/users', moduleAccess.requireAdmin, getAllUsers);

// Approve/Reject users (Admin and SuperAdmin only)
router.put('/users/:userId/approve', moduleAccess.requireAdmin, approveUser);

// Update user role (Admin and SuperAdmin only)
router.put('/users/:userId/role', moduleAccess.requireAdmin, updateUserRole);

// Get user statistics (Admin and SuperAdmin only)
router.get('/stats', moduleAccess.requireAdmin, getUserStats);

module.exports = router;