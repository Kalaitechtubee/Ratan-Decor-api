const express = require('express');
const router = express.Router();
const { 
  getPendingUsers, 
  getAllUsers, 
  approveUser, 
  getUserStats 
} = require('./controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

router.get('/users/pending', getPendingUsers);
router.get('/users', getAllUsers);
router.put('/users/:userId/approve', approveUser);
router.get('/stats', getUserStats);

module.exports = router;
