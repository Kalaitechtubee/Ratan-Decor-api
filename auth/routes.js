// auth/router.js - Updated with security middleware
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

// Token refresh endpoint - can be called with refresh token
// The authenticateToken middleware handles refresh internally
router.post('/refresh', authenticateToken, (req, res) => {
  // If we reached here, authenticateToken already refreshed the token
  return res.json({
    success: true,
    accessToken: req.token,
    message: 'Token refreshed successfully'
  });
});

// Alternative refresh endpoint for compatibility
router.post('/refresh-token', authenticateToken, (req, res) => {
  // If we reached here, authenticateToken already refreshed the token
  return res.json({
    success: true,
    accessToken: req.token,
    message: 'Token refreshed successfully'
  });
});

// Admin/Manager routes for creating staff
router.post('/create-staff',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin,
  createStaffUser
);

// Admin/Manager routes for getting all staff users
router.get('/staff',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin,
  getAllStaffUsers
);

// Admin/Manager routes for getting staff user by ID
router.get('/staff/:id',
  authenticateToken,
  moduleAccess.requireManagerOrAdmin,
  getStaffUserById
);

// Protected user routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateUser);
router.post('/logout', authenticateToken, secureLogout);

// Public route for user types
router.get('/user-types', userTypeController.getAllUserTypes);

module.exports = router;