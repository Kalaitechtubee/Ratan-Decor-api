const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../models');
const { User, ShippingAddress, UserType } = db;

// In-memory store for OTPs (replace with Redis/database in production)
const otpStore = new Map();

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via email
const sendOTP = async (email, otp) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is ${otp}. It is valid for 10 minutes.`,
      html: `<p>Your OTP for password reset is <strong>${otp}</strong>. It is valid for 10 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email} for password reset`);
    return true;
  } catch (error) {
    console.error(`Failed to send OTP to ${email}:`, error);
    throw new Error('Failed to send OTP');
  }
};

const register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      phone, company, address,
      mobile, country, state, city, pincode,
      userTypeId, userTypeName
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
    
    // Handle userType - either by ID or name
    let finalUserTypeId = userTypeId;
    if (!finalUserTypeId && userTypeName) {
      // Try to find userType by name
      const userType = await UserType.findOne({ where: { name: userTypeName } });
      if (userType) {
        finalUserTypeId = userType.id;
      }
    }
    
    // If no userType specified, use default based on role
    if (!finalUserTypeId) {
      // Find or create a default userType based on role
      let defaultTypeName = role === 'General' || role === 'customer' ? 'General' : role;
      let defaultType = await UserType.findOne({ where: { name: defaultTypeName } });
      if (!defaultType) {
        // Fallback to General if specific role type doesn't exist
        defaultType = await UserType.findOne({ where: { name: 'General' } });
        if (!defaultType) {
          // Create General type if it doesn't exist
          defaultType = await UserType.create({
            name: 'General',
            description: 'Default user type',
            isActive: true
          });
        }
      }
      finalUserTypeId = defaultType.id;
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
      company,
      userTypeId: finalUserTypeId
    };

    const user = await User.create(userData);

    // If profile address is provided, create a default shipping address for convenience
    if (address && city && state && country && pincode) {
      try {
        await ShippingAddress.create({
          userId: user.id,
          name: name,
          phone: mobile || null,
          address, city, state, country, pincode,
          isDefault: true,
          addressType: 'Home'
        });
      } catch (e) {
        console.warn('Could not create default shipping address:', e.message);
      }
    }

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

    const user = await User.findOne({
      where: { email },
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
    });
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
        email: user.email,
        userTypeId: user.userTypeId
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
        mobile: user.mobile,
        userTypeId: user.userTypeId,
        userTypeName: user.userType ? user.userType.name : null
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
      attributes: ['id', 'name', 'email', 'role', 'status'] // removed createdAt
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
        status: user.status
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

    // Generate OTP for password reset
    const otp = generateOTP();
    otpStore.set(email, { otp, userId: user.id, expires: Date.now() + 10 * 60 * 1000 }); // 10-minute expiry
    await sendOTP(email, otp);

    res.json({
      message: 'OTP for password reset sent to your email.',
      otpSent: true
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(400).json({ message: error.message });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const storedOTP = otpStore.get(email);
    if (!storedOTP) {
      return res.status(400).json({ message: 'OTP not found or expired' });
    }

    if (storedOTP.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (Date.now() > storedOTP.expires) {
      otpStore.delete(email);
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Generate a reset token to allow password reset
    const resetToken = jwt.sign({ id: storedOTP.userId }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    
    // Clean up OTP
    otpStore.delete(email);

    res.json({
      message: 'OTP verified successfully. Use the reset token to change your password.',
      resetToken
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(400).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'secret');
    } catch (error) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [updated] = await User.update({ password: hashedPassword }, { where: { id: decoded.id } });

    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Password reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
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
  resetPassword,
  verifyOTP
};