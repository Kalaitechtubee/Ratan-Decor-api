// profile/routes.js
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('./controller');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, getProfile);
router.put('/', authMiddleware, updateProfile);

module.exports = router;