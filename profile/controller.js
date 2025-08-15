// profile/controller.js
const { User } = require('../models');

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user }); // Wrap in user object to match frontend expectations
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, userType, role } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Only update fields that are provided
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (userType !== undefined) updateData.userType = userType;
    if (role !== undefined) updateData.role = role;
    
    await user.update(updateData);
    res.json({ user }); // Wrap in user object to match frontend expectations
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { getProfile, updateProfile };