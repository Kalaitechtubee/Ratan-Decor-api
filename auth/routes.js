// auth/router.js - Updated with security middleware
const express = require('express');
const router = express.Router();
const {
  register,
  createStaffUser,
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

// Admin/Manager routes for creating staff
router.post('/create-staff', 
  authenticateToken, 
  moduleAccess.requireManagerOrAdmin, 
  createStaffUser
);

// Protected user routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateUser);
router.post('/logout', authenticateToken, secureLogout);

// Public route for user types
router.get('/user-types', userTypeController.getAllUserTypes);

module.exports = router;