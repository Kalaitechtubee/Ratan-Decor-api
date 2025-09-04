const { User } = require('../models');

const getProfile = async (req, res) => {
  try {
    console.log('=== DEBUG INFO ===');
    console.log('req.user:', req.user);
    console.log('req.user.id:', req.user?.id);
    
    // Check if req.user exists and has id
    if (!req.user || !req.user.id) {
      return res.status(400).json({ 
        message: 'User ID not found in token',
        debug: {
          hasReqUser: !!req.user,
          reqUserKeys: req.user ? Object.keys(req.user) : []
        }
      });
    }

    const userId = req.user.id; // Changed from req.user.userId to req.user.id
    console.log('Looking for user with ID:', userId);

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ 
        message: `User not found with ID: ${userId}`,
        searchedId: userId
      });
    }

    console.log('User found:', user.dataValues);
    res.json({ user });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id; // Changed from req.user?.userId to req.user?.id
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID not found in token' });
    }

    const { name, email, mobile, address, country, state, city, pincode, company } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email; 
    if (mobile !== undefined) updateData.mobile = mobile;
    if (address !== undefined) updateData.address = address;
    if (country !== undefined) updateData.country = country;
    if (state !== undefined) updateData.state = state;
    if (city !== undefined) updateData.city = city;
    if (pincode !== undefined) updateData.pincode = pincode;
    if (company !== undefined) updateData.company = company;

    await user.update(updateData);
    
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    res.json({ 
      message: 'Profile updated successfully',
      user: updatedUser 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = { getProfile, updateProfile };