// routes/auth.js - Enhanced Authentication Routes
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
const { authenticateToken, moduleAccess } = require('../middleware/auth');

// Public routes (no authentication required)
router.post('/register', register); // Self-registration for General, Customer, Architect, Dealer
router.post('/login', login);
router.get('/status/:email', checkStatus);
router.post('/resend-approval', resendApproval);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-otp', verifyOTP);

// Admin/Manager routes for creating staff
router.post('/create-staff', 
  authenticateToken, 
  moduleAccess.requireManagerOrAdmin, 
  createStaffUser
);

// Protected user routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateUser);
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'Logout successful' });
});

module.exports = router;