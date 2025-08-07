// profile/routes.js
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('./controller');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getProfile);
router.put('/', authenticate, updateProfile);

module.exports = router;