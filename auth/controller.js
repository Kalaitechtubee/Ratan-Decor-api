// auth/controller.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { User, ShippingAddress, UserType } = require('../models');

// OTP store (use Redis in production)
const otpStore = new Map();

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Role hierarchy and permissions
const ROLE_HIERARCHY = {
  'superadmin': 100,
  'admin': 90,
  'manager': 80,
  'sales': 60,
  'support': 50,
  'dealer': 40,
  'architect': 40,
  'customer': 20
};

const REGISTRATION_RULES = {
  PUBLIC_ROLES: ['customer'],
  BUSINESS_ROLES: ['architect', 'dealer'],
  STAFF_ROLES: ['manager', 'sales', 'support', 'architect'],
  ADMIN_ROLES: ['admin'],
  SUPERADMIN_ROLES: ['superadmin']
};

// Check if creator can create target role
const canCreateRole = (creatorRole, targetRole) => {
  const creatorRoleLower = creatorRole.toLowerCase();
  const targetRoleLower = targetRole.toLowerCase();
  if (creatorRoleLower === 'superadmin' || creatorRoleLower === 'admin') {
    return true; // Both superadmin and admin can assign any role
  }
  if (creatorRoleLower === 'manager') {
    return ['sales', 'support'].includes(targetRoleLower);
  }
  return false;
};

// Generate OTP
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
      text: `Your OTP for password reset is ${otp}. Valid for 10 minutes.`,
      html: `<p>Your OTP for password reset is <strong>${otp}</strong>. Valid for 10 minutes.</p>`,
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    throw new Error('Failed to send OTP');
  }
};

// SuperAdmin login with hardcoded credentials
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // SuperAdmin hardcoded login
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@ratandecor.com';
    const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';

    let user;

    if (email === SUPERADMIN_EMAIL && password === SUPERADMIN_PASSWORD) {
      user = await User.findOne({
        where: { email: SUPERADMIN_EMAIL },
        include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
      });

      // Create SuperAdmin if doesn't exist
      if (!user) {
        let superAdminUserType = await UserType.findOne({ where: { name: 'superadmin' } });
        if (!superAdminUserType) {
          superAdminUserType = await UserType.create({
            name: 'superadmin',
            description: 'Super Administrator - Developer access',
            isActive: true
          });
        }

        const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
        user = await User.create({
          name: 'Super Administrator',
          email: SUPERADMIN_EMAIL,
          password: hashedPassword,
          role: 'superadmin',
          status: 'Approved',
          userTypeId: superAdminUserType.id,
          mobile: '0000000000',
          country: 'India',
          state: 'Tamil Nadu',
          city: 'Chennai',
          company: 'Ratan Decor'
        });

        user = await User.findByPk(user.id, {
          include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
        });
      }
    } else {
      // Regular user login
      user = await User.findOne({
        where: { email },
        include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Password is incorrect'
        });
      }
    }

    // Generate JWT
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

    // Unified Response for all statuses
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status, // Pending / Rejected / Approved
        company: user.company || 'Ratan Decor',
        mobile: user.mobile,
        userTypeId: user.userTypeId,
        userTypeName: user.userType ? user.userType.name : null
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};


// User registration
const register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      phone, company, address,
      mobile, country, state, city, pincode,
      userTypeId, userTypeName,
      createdBy
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const requestedRole = role || 'customer';
    let initialStatus = 'Approved';
    let requiresApproval = false;
    let canCreate = false;

    // Role-based registration logic
    if (REGISTRATION_RULES.PUBLIC_ROLES.includes(requestedRole)) {
      canCreate = true;
      initialStatus = 'Approved';
    } else if (REGISTRATION_RULES.BUSINESS_ROLES.includes(requestedRole)) {
      canCreate = true;
      initialStatus = 'Pending';
      requiresApproval = true;
    } else if (REGISTRATION_RULES.STAFF_ROLES.includes(requestedRole)) {
      if (!createdBy) {
        return res.status(403).json({
          success: false,
          message: 'Staff roles can only be created by admin or superadmin'
        });
      }
      canCreate = true;
      initialStatus = 'Approved';
    } else if (REGISTRATION_RULES.ADMIN_ROLES.includes(requestedRole)) {
      if (!createdBy) {
        return res.status(403).json({
          success: false,
          message: 'Admin role can only be created by superadmin'
        });
      }
      canCreate = true;
      initialStatus = 'Approved';
    } else if (REGISTRATION_RULES.SUPERADMIN_ROLES.includes(requestedRole)) {
      if (!createdBy) {
        return res.status(403).json({
          success: false,
          message: 'superadmin role can only be created by existing superadmin'
        });
      }
      canCreate = true;
      initialStatus = 'Approved';
    } else {
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

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);

    let finalUserTypeId = userTypeId;
    if (!finalUserTypeId && userTypeName) {
      const userType = await UserType.findOne({ where: { name: userTypeName } });
      if (userType) finalUserTypeId = userType.id;
    }

    if (!finalUserTypeId) {
      let defaultTypeName = ['customer'].includes(requestedRole) ? 'customer' : requestedRole;
      let defaultType = await UserType.findOne({ where: { name: defaultTypeName } });
      if (!defaultType) {
        defaultType = await UserType.findOne({ where: { name: 'customer' } });
        if (!defaultType) {
          defaultType = await UserType.create({
            name: 'customer',
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

    // Create shipping address if provided
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

    // Generate JWT token after registration
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '90d' } // 90 days like you wanted
    );

    res.status(201).json({
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
        requiresApproval,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
// Create staff user (Admin/Manager only)
const createStaffUser = async (req, res) => {
  try {
    const creator = req.user;

    if (!['superadmin', 'admin', 'manager'].includes(creator.role.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Only SuperAdmin, Admin, or Manager can create staff users'
      });
    }

    const { role, name, email, password } = req.body;

    if (!role || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Role, name, email, and password are required for staff creation'
      });
    }

    if (!canCreateRole(creator.role, role)) {
      const creatorRoleLower = creator.role.toLowerCase();
      const allowedRoles = [];
      if (creatorRoleLower === 'superadmin') {
        allowedRoles.push(...REGISTRATION_RULES.STAFF_ROLES, ...REGISTRATION_RULES.ADMIN_ROLES, ...REGISTRATION_RULES.SUPERADMIN_ROLES);
      } else if (creatorRoleLower === 'admin') {
        allowedRoles.push(...REGISTRATION_RULES.STAFF_ROLES);
      } else if (creatorRoleLower === 'manager') {
        allowedRoles.push('sales', 'support');
      }

      return res.status(403).json({
        success: false,
        message: `${creator.role} cannot assign ${role} role`,
        allowedRoles: allowedRoles
      });
    }

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

// Check user status by email
// Check user status by ID
const checkStatus = async (req, res) => {
  try {
    const { id } = req.params; // get id from route params
    const user = await User.findByPk(id); // cleaner than findOne({ where: { id } })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      status: user.status,
    });
  } catch (error) {
    console.error('Check status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Resend approval (placeholder - implement email sending)
const resendApproval = async (req, res) => {
  try {
    const { email } = req.body;
    // TODO: Implement email sending for approval
    res.json({ success: true, message: 'Approval request resent' });
  } catch (error) {
    console.error('Resend approval error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update user profile
const updateUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    // Prevent updating sensitive fields
    delete updates.password;
    delete updates.role;
    delete updates.status;
    await User.update(updates, { where: { id: userId } });
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        mobile: user.mobile,
        company: user.company,
        userTypeId: user.userTypeId,
        userTypeName: user.userType?.name
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Forgot password - send OTP
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const otp = generateOTP();
    otpStore.set(email, { otp, expires: Date.now() + 10 * 60 * 1000 });
    await sendOTP(email, otp);
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reset password with OTP
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const stored = otpStore.get(email);
    if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.update({ password: hashedPassword }, { where: { email } });
    otpStore.delete(email);
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const stored = otpStore.get(email);
    if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  register,
  createStaffUser,
  login,
  checkStatus,
  resendApproval,
  updateUser,
  getProfile,
  forgotPassword,
  resetPassword,
  verifyOTP,
  canCreateRole,
  ROLE_HIERARCHY,
  REGISTRATION_RULES
};