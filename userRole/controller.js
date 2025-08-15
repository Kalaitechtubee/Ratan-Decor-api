const { User } = require('../models');

const userRoleController = {
  // Get all users with role filtering
  async getUsersByRole(req, res) {
    try {
      const { role, status, page = 1, limit = 10 } = req.query;
      
      const whereClause = {};
      if (role) whereClause.role = role;
      if (status) whereClause.status = status;

      const users = await User.findAndCountAll({
        where: whereClause,
        attributes: ['id', 'name', 'email', 'role', 'status', 'mobile', 'company', 'createdAt'],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: users.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(users.count / limit),
          totalItems: users.count
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: error.message
      });
    }
  },

  // Update user role
  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role, status } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Validate role
      const validRoles = ['General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
      }

      // Validate status
      const validStatuses = ['Pending', 'Approved', 'Rejected'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      await user.update({
        role: role || user.role,
        status: status || user.status
      });

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating user role',
        error: error.message
      });
    }
  },

  // Get role statistics
  async getRoleStats(req, res) {
    try {
      const stats = await User.findAll({
        attributes: [
          'role',
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['role', 'status']
      });

      // Organize stats by role
      const roleStats = {};
      stats.forEach(stat => {
        if (!roleStats[stat.role]) {
          roleStats[stat.role] = {};
        }
        roleStats[stat.role][stat.status] = parseInt(stat.dataValues.count);
      });

      res.json({
        success: true,
        data: roleStats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role statistics',
        error: error.message
      });
    }
  },

  // Approve/Reject user applications
  async updateUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Only allow status changes for Pending users
      if (user.status !== 'Pending') {
        return res.status(400).json({
          success: false,
          message: 'Can only update status of pending users'
        });
      }

      await user.update({ status });

      res.json({
        success: true,
        message: `User ${status.toLowerCase()} successfully`,
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating user status',
        error: error.message
      });
    }
  }
};

module.exports = userRoleController;
