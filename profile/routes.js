// // profile/routes.js
// const express = require('express');
// const router = express.Router();
// const { getProfile, updateProfile } = require('./controller');
// const { authMiddleware } = require('../middleware');

// // Get logged-in user's profile
// router.get('/', authMiddleware, getProfile);

// // Update logged-in user's profile
// router.put('/', authMiddleware, updateProfile);

// module.exports = router;// profile/routes.js - FIXED VERSION
// profile/routes.js
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('./controller');
const { authMiddleware } = require('../middleware');

// Get logged-in user's profile
router.get('/', authMiddleware, getProfile);

// Update logged-in user's profile
router.put('/', authMiddleware, updateProfile);

module.exports = router;;