const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { authMiddleware } = require('../middleware/auth'); // Assuming you have auth middleware

const allowedUserTypes = ['Residential', 'Commercial', 'Modular Kitchen', 'Others'];

// Save or update userType
router.post('/set-type', authMiddleware, async (req, res) => {
  console.log('📥 set-type: Incoming body:', req.body); // Debugging log

  const { userId, userType } = req.body;
  if (!userId || !userType) {
    return res.status(400).json({ message: 'userId and userType are required' });
  }

  if (!allowedUserTypes.includes(userType)) {
    return res.status(400).json({
      message: `userType must be one of: ${allowedUserTypes.join(', ')}`,
    });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.userType = userType;
    await user.save();
    console.log('set-type: Updated userType to:', userType); // Debugging log
    res.json({ message: 'User type saved', userType });
  } catch (err) {
    console.error('set-type: Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get userType
router.get('/:userId/type', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  console.log('📥 get-type: Fetching userType for userId:', userId); // Debugging log

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userType = user.userType || 'Residential'; // Default to Residential
    res.json({ userType });
  } catch (err) {
    console.error('get-type: Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;