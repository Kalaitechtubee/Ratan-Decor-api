const { User } = require('../models');

const approveUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.status = 'Approved';
    await user.save();

    res.json({ message: 'User approved successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { approveUser };
