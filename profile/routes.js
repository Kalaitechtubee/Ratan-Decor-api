// routes/profile.js
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('./controller');
const { authMiddleware } = require('../middleware/auth');

// Get current user's profile
router.get('/', authMiddleware, getProfile);

// Update current user's profile  
router.put('/', authMiddleware, updateProfile);

// Get user's order history - redirect to orders API
router.get('/orders', authMiddleware, (req, res) => {
  // This redirects to the unified orders endpoint
  res.redirect(`/api/orders?userId=${req.user.id}`);
});

module.exports = router;