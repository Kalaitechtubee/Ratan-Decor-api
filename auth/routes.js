const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  checkStatus, 
  resendApproval, 
  updateUser, 
  getProfile 
} = require('./controller');
const { authMiddleware } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/status/:email', checkStatus);
router.post('/resend-approval', resendApproval);

// Protected routes
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateUser);
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;