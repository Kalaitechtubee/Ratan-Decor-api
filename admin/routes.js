const express = require('express');
const router = express.Router();
const {
  getPendingUsers, getAllUsers, approveUser,
  getUserStats, updateUserRole, getDashboardStats
} = require('./controller');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits, secureLogout } = require('../middleware/security');

router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.admin);

router.get('/users/pending', auditLogger, getPendingUsers);
router.get('/users', auditLogger, getAllUsers);
router.put('/users/:userId/approve', auditLogger, approveUser);
router.put('/users/:userId/role', auditLogger, updateUserRole);
router.get('/stats', auditLogger, getUserStats);
router.get('/dashboard', auditLogger, getDashboardStats);
router.post('/logout', secureLogout);

router.use((error, req, res, next) => {
  console.error('Admin route error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;