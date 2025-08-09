const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models');
const { User } = db;

// Registration with role-based approval
const register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      phone, company, address,
      mobile, country, state, city, pincode
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine initial status based on role
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
        initialStatus = 'Pending';
        requiresApproval = true;
        break;
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

// Enhanced login with role-based access
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check account status
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

    // Generate token with role and status
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

// Check account status
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

// Resend approval request
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

    // Here you could send email notification to admin
    // For now, just return success message
    res.json({ 
      message: 'Approval request sent to admin. You will be notified once approved.',
      status: user.status
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update user profile
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedUpdates = [
      'name', 'email', 'password', 'mobile',
      'address', 'country', 'state', 'city', 'pincode',
      'company'
    ];
    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const [updated] = await User.update(updates, { where: { id } });

    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // From JWT token

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

module.exports = { 
  register, 
  login, 
  checkStatus, 
  resendApproval, 
  updateUser, 
  getProfile 
};
