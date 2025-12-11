// routes/profile.js (updated: consistent middleware)
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('./controller');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');

// Global middlewares
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.auth);

router.get('/', auditLogger, getProfile);

router.put('/', auditLogger, updateProfile);

router.get('/orders', auditLogger, (req, res) => {
  res.redirect(`/api/orders?userId=${req.user.id}`);
});

module.exports = router;