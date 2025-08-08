// routes/userType.js
const express = require('express');
const router = express.Router();
const { User } = require('../models');

// Save or update userType
router.post('/set-type', async (req, res) => {
  const { userId, userType } = req.body;
  if (!userId || !userType) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.userType = userType;
    await user.save();
    res.json({ message: 'User type saved', userType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get userType
router.get('/:userId/type', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ userType: user.userType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;