// routes/admin.js - Admin Management Routes
const express = require('express');
const router = express.Router();
const {
  getPendingUsers,
  getAllUsers,
  approveUser,
  getUserStats,
} = require('../admin/controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');

// All admin routes require authentication
router.use(authenticateToken);

// User management (Admin only)
router.get('/users/pending', moduleAccess.requireAdmin, getPendingUsers);
router.get('/users', moduleAccess.requireAdmin, getAllUsers);
router.put('/users/:userId/approve', moduleAccess.requireAdmin, approveUser);
router.get('/stats', moduleAccess.requireAdmin, getUserStats);

module.exports = router;