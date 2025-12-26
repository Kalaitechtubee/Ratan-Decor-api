// routes/profile.js (clean version)
const express = require('express');
const router = express.Router();

const { getProfile, updateProfile } = require('./controller');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.auth);

// Get logged-in user's profile
router.get('/', auditLogger, getProfile);

// Update logged-in user's profile
router.put('/', auditLogger, updateProfile);

// Redirect to user's order list while preserving pagination/filter params
router.get('/orders', auditLogger, (req, res) => {
  const queryParams = new URLSearchParams(req.query);
  queryParams.set('userId', req.user.id);
  res.redirect(`/api/orders?${queryParams.toString()}`);
});

module.exports = router;
