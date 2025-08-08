// routes/profile.js
const express = require('express');
const router = express.Router();
const { User } = require('../models');
const authMiddleware = require('../auth/middleware');

router.put('/', authMiddleware, async (req, res) => {
  const { name, email, mobile, address, country, state, city, pincode } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.mobile = mobile || user.mobile;
    user.address = address || user.address;
    user.country = country || user.country;
    user.state = state || user.state;
    user.city = city || user.city;
    user.pincode = pincode || user.pincode;

    await user.save();
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;