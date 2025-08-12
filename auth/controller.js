const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models');
const { User } = db;

// In-memory store for reset tokens (replace with database/Redis in production)
const resetTokens = new Map();

const register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      phone, company, address,
      mobile, country, state, city, pincode
    } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let initialStatus = 'Approved';
    let requiresApproval = false;

    switch (role) {
      case 'General':
      case 'customer':
        initialStatus = 'Approved';
        requiresApproval = false;
        break;
      case 'Architect':
      case 'Dealer':
      case 'Admin':
      case 'Manager':
      case 'Sales':
      case 'Support':
        initialStatus = 'Pending';
        requiresApproval = true;
        break;
      default:
        initialStatus = 'Approved';
        requiresApproval = false;
    }

    const userData = {
      name,
      email,
      password: hashedPassword,
      role: role || 'General',
      status: initialStatus,
      mobile: mobile || phone,
      address,
      country,
      state,
      city,
      pincode,
      company
    };

    const user = await User.create(userData);

    const response = {
      message: requiresApproval 
        ? 'Registration successful. Your account is pending approval.' 
        : 'Registration successful. You can now login.',
      userId: user.id,
      requiresApproval,
      status: initialStatus
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.status === 'Rejected') {
      return res.status(403).json({ 
        message: 'Your account has been rejected. Please contact support.',
        status: 'Rejected'
      });
    }

    if (user.status === 'Pending') {
      return res.status(403).json({ 
        message: 'Your account is pending approval. You will be notified once approved.',
        status: 'Pending',
        requiresApproval: true
      });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        status: user.status,
        email: user.email 
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        company: user.company,
        mobile: user.mobile
      },
      message: 'Login successful'
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const checkStatus = async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await User.findOne({ 
      where: { email },
      attributes: ['id', 'name', 'email', 'role', 'status', 'createdAt']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const resendApproval = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status === 'Approved') {
      return res.status(400).json({ message: 'Account is already approved' });
    }

    if (user.status === 'Rejected') {
      return res.status(400).json({ message: 'Cannot resend approval for rejected account' });
    }

    res.json({ 
      message: 'Approval request sent to admin. You will be notified once approved.',
      status: user.status
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const updates = { ...req.body };

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key]
    );

    const [updated] = await User.update(updates, { where: { id: userId } });

    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    resetTokens.set(resetToken, user.id);

    // In a real app, send this token via email
    // For now, return it in response for testing
    res.json({
      message: 'Password reset link generated. Please check your email.',
      resetToken
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'secret');
    const userId = resetTokens.get(resetToken);

    if (!userId || decoded.id !== userId) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashedPassword }, { where: { id: userId } });

    // Clean up token
    resetTokens.delete(resetToken);

    res.json({ message: 'Password reset successfully. You can now login with your new password.' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { 
  register, 
  login, 
  checkStatus, 
  resendApproval, 
  updateUser, 
  getProfile,
  forgotPassword,
  resetPassword
};