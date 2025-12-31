const { User, ShippingAddress, UserType, VideoCallEnquiry } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../services/jwt.service');
const { getCookieOptions } = require('../middleware/cookieOptions');
const { sessionSecurity, validatePasswordPolicy } = require('../middleware/security');
const bcrypt = require('bcrypt');
const AuthService = require('./service');

// SuperAdmin login handled via env variables in Service logic
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cookieNames = AuthService.getCookieNames(req);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
    const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;
    let user;

    // Strict check for SuperAdmin login using Env variables
    if (SUPERADMIN_EMAIL && email === SUPERADMIN_EMAIL && SUPERADMIN_PASSWORD && password === SUPERADMIN_PASSWORD) {
      // Ensure SuperAdmin exists in DB (creates if missing)
      user = await AuthService.createSuperAdminIfMissing();

      // Fetch full object with relations if just created or found
      if (user) {
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
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'Password is incorrect' });
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication failed' });
    }

    // Check user approval status
    const userRole = user.role?.toLowerCase();
    const isAdminOrSuperAdmin = user.role === 'SuperAdmin' || user.role === 'Admin';
    const isArchitectOrDealer = userRole === 'architect' || userRole === 'dealer';
    const isPending = user.status === 'Pending';
    const isRejected = user.status === 'Rejected';

    // Block rejected users completely
    if (isRejected && !isAdminOrSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Your account has been rejected. Please contact support for assistance.",
        status: user.status
      });
    }

    // Allow pending Architect/Dealer users to log in with limited access
    // They will be redirected to check-status page on frontend
    // Only block if not admin/superadmin, not architect/dealer, and still pending
    if (!isAdminOrSuperAdmin && !isArchitectOrDealer && isPending) {
      return res.status(403).json({
        success: false,
        message: "Account pending approval. Please wait for admin approval.",
        status: user.status
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = await AuthService.generateTokens(user);

    // Set cookies
    res.cookie(cookieNames.refreshToken, refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
    res.cookie(cookieNames.accessToken, accessToken, getCookieOptions(15 * 60 * 1000));

    // Determine appropriate message based on status
    let message = 'Login successful';
    let requiresApproval = false;
    if (isArchitectOrDealer && isPending) {
      message = 'Login successful. Your account is pending approval. You have view-only access.';
      requiresApproval = true;
    }

    return res.json({
      success: true,
      accessToken, // Keep for backward compatibility
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
        zipCode: user.zipCode,
        userTypeId: user.userTypeId,
        userTypeName: user.userType ? user.userType.name : null
      },
      message,
      requiresApproval
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

const register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      phone, company, address,
      mobile, country, state, city, pincode,
      userTypeId, userTypeName,
      createdBy,
      skipTokenGeneration = false
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const passwordValidation = validatePasswordPolicy(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ success: false, message: passwordValidation.errors.join('. ') });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const requestedRole = AuthService.getCanonicalRole(role || 'customer');
    if (!requestedRole) {
      return res.status(400).json({ success: false, message: `Invalid role: ${role}` });
    }

    let initialStatus = 'Approved';
    let requiresApproval = false;
    let canCreate = false;
    let creatorRole = null;

    if (createdBy) {
      const creator = await User.findByPk(createdBy);
      if (creator) creatorRole = creator.role;
    }

    const requestedRoleLower = requestedRole.toLowerCase();
    const RULES = AuthService.REGISTRATION_RULES;

    if (RULES.PUBLIC_ROLES.includes(requestedRoleLower)) {
      canCreate = true;
      initialStatus = 'Approved';
    } else if (RULES.BUSINESS_ROLES.includes(requestedRoleLower)) {
      canCreate = true;
      initialStatus = 'Pending';
      requiresApproval = true;
    } else if (RULES.STAFF_ROLES.includes(requestedRoleLower)) {
      if (!createdBy) return res.status(403).json({ success: false, message: 'Staff roles require authorized creator' });
      if (!AuthService.canCreateRole(creatorRole, requestedRole)) return res.status(403).json({ success: false, message: 'Not authorized to create this role' });
      canCreate = true;
      initialStatus = 'Approved';
    } else {
      return res.status(400).json({ success: false, message: `Invalid role: ${requestedRole}` });
    }

    if (!canCreate) return res.status(403).json({ success: false, message: 'Not authorized' });

    // Unique checks
    if (requestedRole === 'SuperAdmin' || requestedRole === 'Admin') {
      const count = await User.count({ where: { role: requestedRole } });
      if (count > 0) return res.status(403).json({ success: false, message: `Only one ${requestedRole} account is allowed` });
      if (creatorRole !== 'SuperAdmin') return res.status(403).json({ success: false, message: `Only SuperAdmin can create ${requestedRole}` });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    let finalUserTypeId = userTypeId;
    if (!finalUserTypeId && userTypeName) {
      const userType = await UserType.findOne({ where: { name: userTypeName } });
      if (userType) finalUserTypeId = userType.id;
    }

    const user = await User.create({
      name, email, password: hashedPassword, role: requestedRole,
      status: initialStatus, mobile: mobile || phone,
      address, country, state, city, pincode, company,
      userTypeId: finalUserTypeId, createdBy: createdBy || null
    });

    if (address && city && state && country && pincode) {
      try {
        await ShippingAddress.create({
          userId: user.id, name, phone: mobile || phone,
          address, city, state, country, pincode,
          isDefault: true, addressType: 'Home'
        });
      } catch (e) { console.warn('Shipping addr error', e.message); }
    }

    let accessToken = null, refreshToken = null;
    if (!skipTokenGeneration) {
      const tokens = await AuthService.generateTokens(user);
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
      res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
    }

    res.status(201).json({
      success: true,
      message: requiresApproval ? 'Registration successful. Account pending approval.' : 'Registration successful.',
      data: {
        userId: user.id, name: user.name, email: user.email, role: user.role, status: initialStatus, requiresApproval,
        accessToken, refreshToken
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const createStaffUser = async (req, res) => {
  try {
    const creator = req.user;
    if (!['superadmin', 'admin', 'manager'].includes(creator.role.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized calling user' });
    }

    const { role, name, email, password } = req.body;
    if (!role || !name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    req.body.createdBy = creator.id;
    req.body.skipTokenGeneration = true; // IMPORTANT
    return register(req, res);

  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const otp = AuthService.generateOTP();
    AuthService.storeOTP(email, otp);
    await AuthService.sendOTP(email, otp);

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: 'All fields required' });

    if (!AuthService.verifyOTP(email, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const passwordValidation = validatePasswordPolicy(newPassword);
    if (!passwordValidation.isValid) return res.status(400).json({ success: false, message: passwordValidation.errors.join('. ') });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const [affectedRows] = await User.update({ password: hashedPassword }, { where: { email } });

    if (affectedRows === 0) return res.status(404).json({ success: false, message: 'User not found' });

    AuthService.clearOTP(email);
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });

    if (!AuthService.verifyOTP(email, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const logout = async (req, res) => {
  try {
    const cookieNames = AuthService.getCookieNames(req);
    const accessToken = req.token || req.cookies?.[cookieNames.accessToken];
    const refreshToken = req.cookies?.[cookieNames.refreshToken];

    if (accessToken) sessionSecurity.blacklistToken(accessToken);
    if (refreshToken) sessionSecurity.blacklistRefreshToken(refreshToken);

    const clearOptions = getCookieOptions();
    res.clearCookie(cookieNames.accessToken, clearOptions);
    res.clearCookie(cookieNames.refreshToken, clearOptions);

    return res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

const checkStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, status: user.status });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }] });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true, user: {
        id: user.id, name: user.name, email: user.email, role: user.role, status: user.status,
        mobile: user.mobile, company: user.company, address: user.address,
        city: user.city, state: user.state, country: user.country, pincode: user.pincode,
        userTypeId: user.userTypeId, userTypeName: user.userType?.name
      }
    });
  } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.password; delete updates.role; delete updates.status;
    const [rows] = await User.update(updates, { where: { id: req.user.id } });
    if (rows === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'Profile updated' });
  } catch (e) { res.status(500).json({ success: false, message: 'Update failed' }); }
};

const resendApproval = async (req, res) => {
  // Placeholder as in original
  res.json({ success: true, message: 'Approval request resent' });
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
  logout
};