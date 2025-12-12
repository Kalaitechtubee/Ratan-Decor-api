// auth/router.js (clean version – staff routes removed; auth-only)
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

const { authenticateToken } = require('../middleware/auth');
const {
  rateLimits,
  trackSuspiciousActivity,
  enhanceLoginSecurity,
  secureLogout
} = require('../middleware/security');

/* ------------------ PUBLIC ROUTES ------------------ */
router.post('/register', rateLimits.register, register);

router.post(
  '/login',
  rateLimits.auth,
  trackSuspiciousActivity,
  enhanceLoginSecurity(login)
);

router.get('/status/:id', checkStatus);
router.post('/resend-approval', resendApproval);

router.post('/forgot-password', rateLimits.otp, forgotPassword);
router.post('/reset-password', rateLimits.otp, resetPassword);
router.post('/verify-otp', rateLimits.otp, verifyOTP);

/* ------------------ TOKEN REFRESH ------------------ */
router.post('/refresh', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'Token refreshed successfully' });
});

router.post('/refresh-token', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'Token refreshed successfully' });
});

/* ------------------ STAFF CREATION (AUTH ONLY) ------------------ */
router.post('/create-staff', authenticateToken, createStaffUser);

/* ------------------ USER ROUTES ------------------ */
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateUser);
router.post('/logout', authenticateToken, secureLogout);

/* ------------------ PUBLIC: USER TYPES ------------------ */
router.get('/user-types', userTypeController.getAllUserTypes);

/* ------------------ ERROR HANDLING ------------------ */
router.use((error, req, res, next) => {
  console.error('Auth route error:', error);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;