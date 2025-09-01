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

const REGISTRATION_RULES = {
  // Public self-registration roles (no approval needed)
  PUBLIC_ROLES: ['General', 'Customer'],
  
  // Self-registration roles that need approval
  BUSINESS_ROLES: ['Architect', 'Dealer'],
  
  // Staff roles that only admins/managers can create
  STAFF_ROLES: ['Manager', 'Sales', 'Support'],
  
  // Admin role - only other admins can create
  ADMIN_ROLES: ['Admin']
};

// Enhanced registration with role-based logic
const register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      phone, company, address,
      mobile, country, state, city, pincode,
      userTypeId, userTypeName,
      createdBy // Admin/Manager creating user
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and password are required' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    const requestedRole = role || 'General';
    let initialStatus = 'Approved';
    let requiresApproval = false;
    let canCreate = false;

    // Determine if registration is allowed based on role and creator
    if (REGISTRATION_RULES.PUBLIC_ROLES.includes(requestedRole)) {
      // Anyone can self-register as General/Customer
      canCreate = true;
      initialStatus = 'Approved';
      requiresApproval = false;
    } 
    else if (REGISTRATION_RULES.BUSINESS_ROLES.includes(requestedRole)) {
      // Self-registration for business roles (needs approval)
      canCreate = true;
      initialStatus = 'Pending';
      requiresApproval = true;
    }
    else if (REGISTRATION_RULES.STAFF_ROLES.includes(requestedRole)) {
      // Only Admin/Manager can create staff roles
      if (!createdBy) {
        return res.status(403).json({
          success: false,
          message: 'Staff roles can only be created by Admin or Manager'
        });
      }
      canCreate = true;
      initialStatus = 'Approved'; // Staff created by admin are pre-approved
      requiresApproval = false;
    }
    else if (REGISTRATION_RULES.ADMIN_ROLES.includes(requestedRole)) {
      // Only Admin can create Admin
      if (!createdBy) {
        return res.status(403).json({
          success: false,
          message: 'Admin role can only be created by existing Admin'
        });
      }
      canCreate = true;
      initialStatus = 'Approved';
      requiresApproval = false;
    }
    else {
      return res.status(400).json({
        success: false,
        message: `Invalid role: ${requestedRole}`
      });
    }

    if (!canCreate) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to create this role'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Handle userType
    let finalUserTypeId = userTypeId;
    if (!finalUserTypeId && userTypeName) {
      const userType = await UserType.findOne({ where: { name: userTypeName } });
      if (userType) {
        finalUserTypeId = userType.id;
      }
    }

    // Default userType based on role
    if (!finalUserTypeId) {
      let defaultTypeName = ['General', 'Customer'].includes(requestedRole) ? 'General' : requestedRole;
      let defaultType = await UserType.findOne({ where: { name: defaultTypeName } });
      if (!defaultType) {
        defaultType = await UserType.findOne({ where: { name: 'General' } });
        if (!defaultType) {
          defaultType = await UserType.create({
            name: 'General',
            description: 'Default user type',
            isActive: true
          });
        }
      }
      finalUserTypeId = defaultType.id;
    }

    // Create user
    const userData = {
      name,
      email,
      password: hashedPassword,
      role: requestedRole,
      status: initialStatus,
      mobile: mobile || phone,
      address,
      country,
      state,
      city,
      pincode,
      company,
      userTypeId: finalUserTypeId,
      createdBy: createdBy || null
    };

    const user = await User.create(userData);

    // Create default shipping address if provided
    if (address && city && state && country && pincode) {
      try {
        await ShippingAddress.create({
          userId: user.id,
          name: name,
          phone: mobile || phone || null,
          address, city, state, country, pincode,
          isDefault: true,
          addressType: 'Home'
        });
      } catch (e) {
        console.warn('Could not create default shipping address:', e.message);
      }
    }

    // Response
    const response = {
      success: true,
      message: requiresApproval 
        ? 'Registration successful. Your account is pending approval.' 
        : 'Registration successful. You can now login.',
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: initialStatus,
        requiresApproval
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};
// Admin/Manager endpoint to create staff users
const createStaffUser = async (req, res) => {
  try {
    const creator = req.user;
    
    // Verify creator permissions
    if (!['Admin', 'Manager'].includes(creator.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only Admin or Manager can create staff users'
      });
    }

    const { role } = req.body;

    // Managers cannot create Admins
    if (creator.role === 'Manager' && role === 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Managers cannot create Admin users'
      });
    }

    // Validate staff role
    const allowedRoles = creator.role === 'Admin' 
      ? ['Manager', 'Sales', 'Support', 'Admin']
      : ['Manager', 'Sales', 'Support'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`
      });
    }

    // Call the main register function with createdBy flag
    req.body.createdBy = creator.id;
    return register(req, res);
    
  } catch (error) {
    console.error('Create staff user error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
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
  verifyOTP,
  createStaffUser,

};