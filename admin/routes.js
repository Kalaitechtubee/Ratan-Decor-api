const express = require('express');
const router = express.Router();
const { approveUser } = require('./controller');
const { authenticate, authorize } = require('../middleware/auth'); // ✅ FIXED

router.post('/approve-user', authenticate, authorize(['Admin']), approveUser);

module.exports = router;
