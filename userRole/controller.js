// controllers/userRoleController.js
const { User, UserType } = require('../models');
const { fn, col, Op } = require('sequelize');

const userRoleController = {
  // ✅ Get all roles
  async getAllRoles(req, res) {
    try {
      const roles = ['General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support'];
      res.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ Get users with filters (role, status, search, pagination)
  async getUsersByRole(req, res) {
    try {
      const { role, status, page = 1, limit = 10, search } = req.query;
      const where = {};

      if (role) where.role = role;
      if (status) where.status = status;

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }

      const users = await User.findAndCountAll({
        where,
        attributes: [
          'id',
          'name',
          'email',
          'role',
          'status',
          'mobile',
          'company',
          'createdAt',
          'userTypeId'
        ],
        include: [
          { model: UserType, as: 'userType', attributes: ['id', 'name'] }
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['createdAt', 'DESC']],
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
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ Update user role/status/userType
  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role, status, userTypeId } = req.body;

      const user = await User.findByPk(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const validRoles = ['General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }

      const validStatuses = ['Pending', 'Approved', 'Rejected'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      if (userTypeId) {
        const userType = await UserType.findByPk(userTypeId);
        if (!userType) {
          return res.status(400).json({ success: false, message: 'Invalid userTypeId' });
        }
      }

      await user.update({
        role: role || user.role,
        status: status || user.status,
        userTypeId: userTypeId !== undefined ? userTypeId : user.userTypeId,
      });

      const updatedUser = await User.findByPk(id, {
        attributes: { exclude: ['password'] },
        include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
      });

      res.json({ success: true, message: 'User updated successfully', data: updatedUser });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ Role stats (role → status → count)
  async getRoleStats(req, res) {
    try {
      const stats = await User.findAll({
        attributes: [
          'role',
          'status',
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['role', 'status'],
      });

      const roleStats = {};
      stats.forEach((stat) => {
        if (!roleStats[stat.role]) roleStats[stat.role] = {};
        roleStats[stat.role][stat.status] = parseInt(stat.dataValues.count);
      });

      res.json({ success: true, data: roleStats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  

  // ✅ Update user status (only Pending → Approved/Rejected)
  async updateUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      const user = await User.findByPk(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      if (user.status !== 'Pending') {
        return res.status(400).json({ success: false, message: 'Can only update Pending users' });
      }

      const validStatuses = ['Pending', 'Approved', 'Rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      await user.update({ status, rejectionReason: status === 'Rejected' ? reason || null : null });

      const updatedUser = await User.findByPk(id, {
        attributes: { exclude: ['password'] },
        include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
      });

      res.json({ success: true, message: `User ${status.toLowerCase()} successfully`, data: updatedUser });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = userRoleController;