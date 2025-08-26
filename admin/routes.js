const express = require('express');
const router = express.Router();
const {
  getPendingUsers,
  getAllUsers,
  approveUser,
  getUserStats,
} = require('./controller');
const { authMiddleware, requireAdmin } = require('../middleware');

// 🔐 All admin routes require authentication & admin access
router.use(authMiddleware);
router.use(requireAdmin);

// Get pending users (with pagination + search)
router.get('/users/pending', getPendingUsers);

// Get all users (with pagination + search)
router.get('/users', getAllUsers);

// Approve or reject a user
router.put('/users/:userId/approve', approveUser);

// Get role/status statistics
router.get('/stats', getUserStats);

module.exports = router;
