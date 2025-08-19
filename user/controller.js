const { User, UserType } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, status, userTypeName } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) {
      where.role = role;
    }
    if (status) {
      where.status = status;
    }

    const include = [
      {
        model: UserType,
        as: 'userType',
        attributes: ['id', 'name'],
        ...(userTypeName && {
          where: { name: { [Op.like]: `%${userTypeName}%` } },
        }),
      },
    ];

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      include,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(count / limitNum),
        totalItems: count,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error in getUserById:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, mobile, company, role, status, userTypeId } = req.body;
    const validRoles = ['General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support'];
    const validStatuses = ['Pending', 'Approved', 'Rejected'];

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number',
      });
    }

    // Validate role
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Validate status
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Validate userTypeId
    let finalUserTypeId = userTypeId;
    if (userTypeId) {
      const userType = await UserType.findByPk(userTypeId);
      if (!userType) {
        return res.status(400).json({ success: false, message: 'Invalid userTypeId' });
      }
    } else {
      // Ensure General user type exists
      let generalType = await UserType.findOne({ where: { name: 'General' } });
      if (!generalType) {
        generalType = await UserType.create({ name: 'General', isActive: true });
      }
      finalUserTypeId = generalType.id;
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      company,
      role,
      status: status || 'Pending',
      userTypeId: finalUserTypeId,
      createdAt: new Date(),
    });

    const userWithoutPassword = user.toJSON();
    delete userWithoutPassword.password;

    res.status(201).json({ success: true, data: userWithoutPassword });
  } catch (error) {
    console.error('Error in createUser:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(400).json({ success: false, message: 'Email already exists' });
    } else {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, mobile, company, role, status, userTypeId } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const validRoles = ['General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support'];
    const validStatuses = ['Pending', 'Approved', 'Rejected'];

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }
      const existingUser = await User.findOne({ where: { email, id: { [Op.ne]: req.params.id } } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
    }

    // Validate role
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Validate status
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Validate userTypeId
    if (userTypeId) {
      const userType = await UserType.findByPk(userTypeId);
      if (!userType) {
        return res.status(400).json({ success: false, message: 'Invalid userTypeId' });
      }
    }

    await user.update({
      name: name || user.name,
      email: email || user.email,
      mobile: mobile !== undefined ? mobile : user.mobile,
      company: company !== undefined ? company : user.company,
      role: role || user.role,
      status: status || user.status,
      userTypeId: userTypeId !== undefined ? userTypeId : user.userTypeId,
    });

    const updatedUser = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }],
    });

    res.json({ success: true, message: 'User updated successfully', data: updatedUser });
  } catch (error) {
    console.error('Error in updateUser:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(400).json({ success: false, message: 'Email already exists' });
    } else {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await user.destroy();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};