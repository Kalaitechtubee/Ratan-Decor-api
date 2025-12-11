// auth/router.js (updated: aligned with moduleAccess.requireAdmin for staff routes, consistent middleware)
const express = require('express');
const router = express.Router();
const {
  register,
  createStaffUser,
  getAllStaffUsers,
  getStaffUserById,
  login,
  checkStatus,
  resendApproval,
  updateUser,
  getProfile,
  forgotPassword,
  resetPassword,
  verifyOTP
} = require('./controller');
const userTypeController = require('../userType/controller');
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { rateLimits, trackSuspiciousActivity, enhanceLoginSecurity, secureLogout } = require('../middleware/security');

// Public routes with rate limiting
router.post('/register', rateLimits.register, register);
router.post('/login', rateLimits.auth, trackSuspiciousActivity, enhanceLoginSecurity(login));
router.get('/status/:id', checkStatus);
router.post('/resend-approval', resendApproval);
router.post('/forgot-password', rateLimits.otp, forgotPassword);
router.post('/reset-password', rateLimits.otp, resetPassword);
router.post('/verify-otp', rateLimits.otp, verifyOTP);

// Token refresh endpoint - handled by authenticateToken middleware
router.post('/refresh', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token refreshed successfully'
  });
});

// Alternative refresh endpoint for compatibility
router.post('/refresh-token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token refreshed successfully'
  });
});

// Admin routes for staff management (SuperAdmin/Admin only)
router.post('/create-staff', authenticateToken, moduleAccess.requireAdmin, createStaffUser);
router.get('/staff', authenticateToken, moduleAccess.requireAdmin, getAllStaffUsers);
router.get('/staff/:id', authenticateToken, moduleAccess.requireAdmin, getStaffUserById);

// Protected user routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateUser);
router.post('/logout', authenticateToken, secureLogout);

// Public route for user types
router.get('/user-types', userTypeController.getAllUserTypes);

// Error handling
router.use((error, req, res, next) => {
  console.error('Auth route error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;