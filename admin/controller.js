const { User } = require('../models');

// Get all pending users
const getPendingUsers = async (req, res) => {
  try {
    const pendingUsers = await User.findAll({
      where: { status: 'Pending' },
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({ users: pendingUsers });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({ users });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Approve user
const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await user.update({ status });

    // Here you could send email notification to user
    const message = status === 'Approved' 
      ? 'User approved successfully' 
      : `User rejected. Reason: ${reason || 'No reason provided'}`;

    res.json({ 
      message,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const stats = await User.findAll({
      attributes: [
        'status',
        'role',
        [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
      ],
      group: ['status', 'role']
    });

    res.json({ stats });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getPendingUsers,
  getAllUsers,
  approveUser,
  getUserStats
};
