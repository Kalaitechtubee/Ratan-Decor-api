// auth/controller.js (updated: removed duplicate staff management functions; kept auth-focused)
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { User, ShippingAddress, UserType, VideoCallEnquiry } = require('../models');
const { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../services/jwt.service');
const { getCookieOptions } = require('../middleware/cookieOptions');
const { sessionSecurity, validatePasswordPolicy } = require('../middleware/security');

// OTP store (use Redis in production)
const otpStore = new Map();

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Role hierarchy and permissions
const ROLE_HIERARCHY = {
  'SuperAdmin': 100,
  'Admin': 90,
  'Manager': 80,
  'Sales': 60,
  'Support': 50,
  'Dealer': 40,
  'Architect': 40,
  'General': 30,
  'customer': 20
};

// Canonical role map (case-insensitive input -> stored value)
const ROLE_CANONICAL = {
  superadmin: 'SuperAdmin',
  admin: 'Admin',
  manager: 'Manager',
  sales: 'Sales',
  support: 'Support',
  dealer: 'Dealer',
  architect: 'Architect',
  general: 'General',
  customer: 'customer'
};

const REGISTRATION_RULES = {
  PUBLIC_ROLES: ['customer', 'general'],
  BUSINESS_ROLES: ['architect', 'dealer'],
  STAFF_ROLES: ['admin', 'manager', 'sales', 'support', 'superadmin'],
  ADMIN_ROLES: ['admin'],
  SUPERADMIN_ROLES: ['superadmin']
};

// Check if creator can create target role
const canCreateRole = (creatorRole, targetRole) => {
  if (creatorRole === 'SuperAdmin' || creatorRole === 'Admin') {
    return true; // Both SuperAdmin and Admin can assign any role
  }
  if (creatorRole === 'Manager') {
    return ['Sales', 'Support'].includes(targetRole);
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
    console.error('Send OTP error:', error);
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
        const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
        user = await User.create({
          name: 'Super Administrator',
          email: SUPERADMIN_EMAIL,
          password: hashedPassword,
          role: 'SuperAdmin',
          status: 'Approved',
          userTypeId: null, // Hardcoded SuperAdmin doesn't need a UserType
          mobile: '0000000000',
          country: 'India',
          state: 'Tamil Nadu',
          city: 'Chennai',
          company: 'Ratan Decor',
          loginAttempts: 0
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

    // Check user approval status
    if (user.role !== 'SuperAdmin' && user.role !== 'Admin' && user.status !== 'Approved') {
      return res.status(403).json({
        success: false,
        message: user.status === 'Pending'
          ? "Account pending approval. Please wait for admin approval."
          : "Account has been rejected. Contact support for assistance.",
        status: user.status
      });
    }

    // Generate tokens using jwt.service
    const accessToken = generateAccessToken({
      id: user.id,
      role: user.role,
      status: user.status,
      email: user.email,
      userTypeId: user.userTypeId
    });
    const refreshToken = generateRefreshToken({
      id: user.id,
      role: user.role,
      status: user.status,
      email: user.email,
      userTypeId: user.userTypeId
    });

    // Set tokens in httpOnly cookies with consistent options
    res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
    res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000)); // 15 minutes

    // Response without access token (now in secure cookie)
    // Keep accessToken in response for backward compatibility during migration
    return res.json({
      success: true,
      accessToken, // TODO: Remove after frontend migration
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        company: user.company || 'Ratan Decor',
        mobile: user.mobile,
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        pincode: user.pincode,
        zipCode: user.zipCode, // legacy support if needed
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

// User registration (COMPLETE FIXED VERSION)
const register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      phone, company, address,
      mobile, country, state, city, pincode,
      userTypeId, userTypeName,
      createdBy,
      skipTokenGeneration = false  // NEW: Flag to skip token generation for staff creation
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    const passwordValidation = validatePasswordPolicy(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.errors.join('. ')
      });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Normalize role to canonical value (case-insensitive)
    const roleInput = (role || 'customer').toString().trim();
    const roleKey = roleInput.toLowerCase();
    const requestedRole = ROLE_CANONICAL[roleKey];
    if (!requestedRole) {
      return res.status(400).json({
        success: false,
        message: `Invalid role: ${roleInput}`
      });
    }

    let initialStatus = 'Approved';
    let requiresApproval = false;
    let canCreate = false;
    let creatorRole = null;

    // Fetch creator role if createdBy provided
    if (createdBy) {
      const creator = await User.findByPk(createdBy);
      if (!creator) {
        return res.status(404).json({
          success: false,
          message: 'Creator not found'
        });
      }
      creatorRole = creator.role;
    }

    // Role-based registration logic
    const requestedRoleLower = requestedRole.toLowerCase();
    if (REGISTRATION_RULES.PUBLIC_ROLES.includes(requestedRoleLower)) {
      canCreate = true;
      initialStatus = 'Approved';
    } else if (REGISTRATION_RULES.BUSINESS_ROLES.includes(requestedRoleLower)) {
      canCreate = true;
      initialStatus = 'Pending';
      requiresApproval = true;
    } else if (REGISTRATION_RULES.STAFF_ROLES.includes(requestedRoleLower)) {
      if (!createdBy) {
        return res.status(403).json({
          success: false,
          message: 'Staff roles can only be created by admin or superadmin'
        });
      }
      if (!canCreateRole(creatorRole, requestedRole)) {
        return res.status(403).json({
          success: false,
          message: 'Creator not authorized to create this role'
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

    // Enforce uniqueness for SuperAdmin and Admin
    if (requestedRole === 'SuperAdmin') {
      const superAdminCount = await User.count({ where: { role: 'SuperAdmin' } });
      if (superAdminCount > 0) {
        return res.status(403).json({
          success: false,
          message: 'Only one SuperAdmin account is allowed'
        });
      }
      if (creatorRole !== 'SuperAdmin') {
        return res.status(403).json({
          success: false,
          message: 'Only existing SuperAdmin can create SuperAdmin'
        });
      }
    } else if (requestedRole === 'Admin') {
      const adminCount = await User.count({ where: { role: 'Admin' } });
      if (adminCount > 0) {
        return res.status(403).json({
          success: false,
          message: 'Only one Admin account is allowed'
        });
      }
      if (creatorRole !== 'SuperAdmin') {
        return res.status(403).json({
          success: false,
          message: 'Only SuperAdmin can create Admin'
        });
      }
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    let finalUserTypeId = userTypeId;
    if (!finalUserTypeId && userTypeName) {
      const userType = await UserType.findOne({ where: { name: userTypeName } });
      if (userType) finalUserTypeId = userType.id;
    }

    // If no userTypeId is provided or found, finalUserTypeId remains the provided userTypeId (or null)
    // The User model allows allowNull: true for userTypeId, so this is safe and prevents automatic creation.

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

    // ✅ CRITICAL FIX: Only generate and set tokens if NOT creating staff
    let accessToken = null;
    let refreshToken = null;

    if (!skipTokenGeneration) {
      // Generate tokens for normal registration/login flow
      accessToken = generateAccessToken({
        id: user.id,
        role: user.role,
        status: user.status,
        email: user.email,
        userTypeId: user.userTypeId
      });
      refreshToken = generateRefreshToken({
        id: user.id,
        role: user.role,
        status: user.status,
        email: user.email,
        userTypeId: user.userTypeId
      });

      // Set tokens in httpOnly cookies with consistent options
      res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
      res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
    }

    // Build response data
    const responseData = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: initialStatus,
      requiresApproval
    };

    // Only include tokens in response if they were generated
    if (!skipTokenGeneration) {
      responseData.accessToken = accessToken;
      responseData.refreshToken = refreshToken;
    }

    res.status(201).json({
      success: true,
      message: requiresApproval
        ? 'Registration successful. Your account is pending approval.'
        : skipTokenGeneration
          ? 'Staff user created successfully.'
          : 'Registration successful. You can now login.',
      data: responseData
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate entry error'
      });
    }
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Create staff user (COMPLETE FIXED VERSION)
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

    // Normalize role
    const roleInput = role.toString().trim();
    const roleKey = roleInput.toLowerCase();
    const requestedRole = ROLE_CANONICAL[roleKey];
    if (!requestedRole) {
      return res.status(400).json({
        success: false,
        message: `Invalid role: ${roleInput}`
      });
    }

    if (!canCreateRole(creator.role, requestedRole)) {
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

    // Enforce uniqueness for SuperAdmin and Admin
    if (requestedRole === 'SuperAdmin') {
      const superAdminCount = await User.count({ where: { role: 'SuperAdmin' } });
      if (superAdminCount > 0) {
        return res.status(403).json({
          success: false,
          message: 'Only one SuperAdmin account is allowed'
        });
      }
      if (creator.role !== 'SuperAdmin') {
        return res.status(403).json({
          success: false,
          message: 'Only existing SuperAdmin can create SuperAdmin'
        });
      }
    } else if (requestedRole === 'Admin') {
      const adminCount = await User.count({ where: { role: 'Admin' } });
      if (adminCount > 0) {
        return res.status(403).json({
          success: false,
          message: 'Only one Admin account is allowed'
        });
      }
      if (creator.role !== 'SuperAdmin') {
        return res.status(403).json({
          success: false,
          message: 'Only SuperAdmin can create Admin'
        });
      }
    }

    // ✅ CRITICAL FIX: Set skipTokenGeneration flag before calling register
    req.body.createdBy = creator.id;
    req.body.role = requestedRole;
    req.body.skipTokenGeneration = true;  // This prevents cookie overwrite!

    return register(req, res);
  } catch (error) {
    console.error('Create staff user error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

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

    const [affectedRows] = await User.update(updates, { where: { id: userId } });
    if (affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

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
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        pincode: user.pincode,
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
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

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
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
    }

    const passwordValidation = validatePasswordPolicy(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.errors.join('. ')
      });
    }

    const stored = otpStore.get(email);
    if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const [affectedRows] = await User.update({ password: hashedPassword }, { where: { email } });
    if (affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

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
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

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

// Logout
const logout = async (req, res) => {
  try {
    const accessToken = req.token || req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;

    if (accessToken) sessionSecurity.blacklistToken(accessToken);
    if (refreshToken) sessionSecurity.blacklistRefreshToken(refreshToken);

    const clearOptions = getCookieOptions();
    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    return res.json({
      success: true,
      message: 'Logout successful. Tokens invalidated and cookies cleared.'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

module.exports = {
  login,
  register,
  createStaffUser,
  checkStatus,
  resendApproval,
  updateUser,
  getProfile,
  forgotPassword,
  resetPassword,
  verifyOTP,
  logout,
  canCreateRole,
  ROLE_HIERARCHY,
  REGISTRATION_RULES
};