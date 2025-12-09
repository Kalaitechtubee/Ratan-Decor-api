// routes/profile.js - Updated without express-validator
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('./controller');
const { authMiddleware } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(authMiddleware); // Auth required for all
router.use(sanitizeInput); // Global sanitization
router.use(rateLimits.general); // Global rate limiting

// Get profile (authenticated user)
router.get('/',
  auditLogger,
  getProfile
);

// Update profile (authenticated user - prevents sensitive fields)
router.put('/',
  auditLogger,
  updateProfile
);

// Redirect to user orders (authenticated)
router.get('/orders',
  auditLogger,
  (req, res) => {
    res.redirect(`/api/orders?userId=${req.user.id}`);
  }
);

module.exports = router;