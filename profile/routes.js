
const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('./controller');
const { authMiddleware } = require('../middleware/auth');


router.get('/', authMiddleware, getProfile);


router.put('/', authMiddleware, updateProfile);

router.get('/orders', authMiddleware, (req, res) => {

  res.redirect(`/api/orders?userId=${req.user.id}`);
});

module.exports = router;