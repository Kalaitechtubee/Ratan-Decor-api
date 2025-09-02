const { User } = require('../models');
const { Op, fn, col } = require('sequelize');

// Import canCreateRole from the auth controller where it is defined
const { canCreateRole } = require('../auth/controller');

// Get all pending users (with pagination + search)
const getPendingUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const where = { status: 'Pending' };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const users = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      data: users.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(users.count / limit),
        totalItems: users.count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all users (with pagination + search)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const where = {};

    // Add search filter
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add role filter
    if (role && role !== 'all') {
      where.role = role;
    }

    // Add status filter
    if (status && status !== 'all') {
      where.status = status;
    }

    const users = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email', 'role'],
          required: false,
        },
      ],
    });

    res.json({
      success: true,
      data: users.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(users.count / limit),
        totalItems: users.count,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve/Reject user (with reason support)
const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    const currentUser = req.user;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // SECURITY: Prevent modifying SuperAdmin or higher-level users
    if (user.role === 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify SuperAdmin users',
      });
    }

    // SECURITY: Admin cannot modify other Admins (only SuperAdmin can)
    if (user.role === 'Admin' && currentUser.role !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Only SuperAdmin can modify Admin users',
      });
    }

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be Approved or Rejected',
      });
    }

    // Update user status
    const updateData = { status };
    if (status === 'Rejected') {
      updateData.rejectionReason = reason || 'No reason provided';
    } else {
      updateData.rejectionReason = null;
    }

    await user.update(updateData);

    const message = status === 'Approved'
      ? 'User approved successfully'
      : 'User rejected successfully';

    res.json({
      success: true,
      message,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        rejectionReason: user.rejectionReason || null,
      },
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user statistics (role → status → count) with SuperAdmin
const getUserStats = async (req, res) => {
  try {
    const stats = await User.findAll({
      attributes: [
        'role',
        'status',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['role', 'status'],
    });

    const formattedStats = {};
    stats.forEach((stat) => {
      if (!formattedStats[stat.role]) formattedStats[stat.role] = {};
      formattedStats[stat.role][stat.status] = parseInt(stat.dataValues.count);
    });

    // Add role hierarchy information
    const roleHierarchy = {
      SuperAdmin: 100,
      Admin: 90,
      Manager: 80,
      Sales: 60,
      Support: 50,
      Dealer: 40,
      Architect: 40,
      Customer: 20,
      General: 10,
    };

    res.json({
      success: true,
      data: formattedStats,
      roleHierarchy,
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user role (SuperAdmin/Admin only)
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, status } = req.body;
    const currentUser = req.user;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // SECURITY: Role-based permissions for updates
    if (role && !canCreateRole(currentUser.role, role)) {
      return res.status(403).json({
        success: false,
        message: `${currentUser.role} cannot assign ${role} role`,
      });
    }

    // SECURITY: Cannot modify SuperAdmin (except by SuperAdmin)
    if (user.role === 'SuperAdmin' && currentUser.role !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Only SuperAdmin can modify SuperAdmin users',
      });
    }

    // Update user
    const updateData = {};
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    await user.update(updateData);

    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPendingUsers,
  getAllUsers,
  approveUser,
  getUserStats,
  updateUserRole,
};