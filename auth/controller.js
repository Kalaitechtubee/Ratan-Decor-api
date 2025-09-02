const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../models');
const { User, ShippingAddress, UserType } = db;

// In-memory store for OTPs (replace with Redis/database in production)
const otpStore = new Map();

// FIXED: Correct nodemailer method name
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

// UPDATED: Enhanced registration rules with SuperAdmin
const REGISTRATION_RULES = {
  // Public self-registration roles (no approval needed)
  PUBLIC_ROLES: ['General', 'Customer'],
  
  // Self-registration roles that need approval
  BUSINESS_ROLES: ['Architect', 'Dealer'],
  
  // Staff roles that only admins/managers can create
  STAFF_ROLES: ['Manager', 'Sales', 'Support'],
  
  // Admin role - only SuperAdmin can create
  ADMIN_ROLES: ['Admin'],
  
  // SuperAdmin role - only other SuperAdmins can create (for developers)
  SUPERADMIN_ROLES: ['SuperAdmin']
};

// Role hierarchy for permissions
const ROLE_HIERARCHY = {
  'SuperAdmin': 100,   // Highest level - developers only
  'Admin': 90,         // Full system access
  'Manager': 80,       // User management + business operations
  'Sales': 60,         // Enquiries + Orders
  'Support': 50,       // Products only
  'Dealer': 40,        // Business user
  'Architect': 40,     // Business user
  'Customer': 20,      // End user
  'General': 10        // Basic user
};

// Check if creator can create the requested role
const canCreateRole = (creatorRole, targetRole) => {
  const creatorLevel = ROLE_HIERARCHY[creatorRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  
  // SuperAdmin can create anyone except SuperAdmin (needs another SuperAdmin)
  if (creatorRole === 'SuperAdmin') {
    return targetRole !== 'SuperAdmin';
  }
  
  // Admin can create Manager, Sales, Support (not Admin or SuperAdmin)
  if (creatorRole === 'Admin') {
    return REGISTRATION_RULES.STAFF_ROLES.includes(targetRole);
  }
  
  // Manager can create Sales, Support (not Manager, Admin, or SuperAdmin)
  if (creatorRole === 'Manager') {
    return ['Sales', 'Support'].includes(targetRole);
  }
  
  return false;
};

// UPDATED: Enhanced login with SuperAdmin hardcoded credentials
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // NEW: SuperAdmin hardcoded login support
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@ratandecor.com';
    const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';

    // Check for hardcoded SuperAdmin credentials
    if (email === SUPERADMIN_EMAIL && password === SUPERADMIN_PASSWORD) {
      console.log('🔐 SuperAdmin login with hardcoded credentials');
      
      // Check if SuperAdmin user exists in database
      let superAdminUser = await User.findOne({
        where: { email: SUPERADMIN_EMAIL },
        include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
      });

      // Create SuperAdmin user if doesn't exist
      if (!superAdminUser) {
        console.log('📝 Creating SuperAdmin user in database...');
        
        // Ensure SuperAdmin UserType exists
        let superAdminUserType = await UserType.findOne({ where: { name: 'SuperAdmin' } });
        if (!superAdminUserType) {
          superAdminUserType = await UserType.create({
            name: 'SuperAdmin',
            description: 'Super Administrator - Developer access',
            isActive: true
          });
        }

        const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
        superAdminUser = await User.create({
          name: 'Super Administrator',
          email: SUPERADMIN_EMAIL,
          password: hashedPassword,
          role: 'SuperAdmin',
          status: 'Approved',
          userTypeId: superAdminUserType.id,
          mobile: '0000000000',
          country: 'India',
          state: 'Tamil Nadu',
          city: 'Chennai'
        });

        // Reload with userType
        superAdminUser = await User.findByPk(superAdminUser.id, {
          include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
        });
      }

      // Generate token for SuperAdmin
      const token = jwt.sign(
        {
          id: superAdminUser.id,
          role: superAdminUser.role,
          status: superAdminUser.status,
          email: superAdminUser.email,
          userTypeId: superAdminUser.userTypeId
        },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: superAdminUser.id,
          name: superAdminUser.name,
          email: superAdminUser.email,
          role: superAdminUser.role,
          status: superAdminUser.status,
          company: superAdminUser.company,
          mobile: superAdminUser.mobile,
          userTypeId: superAdminUser.userTypeId,
          userTypeName: superAdminUser.userType ? superAdminUser.userType.name : null
        },
        message: 'SuperAdmin login successful',
        loginType: 'hardcoded'
      });
    }

    // Regular database user login
    const user = await User.findOne({
      where: { email },
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    if (user.status === 'Rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been rejected. Please contact support.',
        status: 'Rejected'
      });
    }

    // FIXED: SuperAdmin bypasses approval check
    if (user.status === 'Pending' && user.role !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
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
      success: true,
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
      message: 'Login successful',
      loginType: 'database'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed. Please try again.' 
    });
  }
};

// FIXED: Enhanced registration with proper role validation
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

    // FIXED: Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
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
      // Only Admin/SuperAdmin can create staff roles
      if (!createdBy) {
        return res.status(403).json({
          success: false,
          message: 'Staff roles can only be created by Admin or SuperAdmin'
        });
      }
      canCreate = true;
      initialStatus = 'Approved'; // Staff created by admin are pre-approved
      requiresApproval = false;
    }
    else if (REGISTRATION_RULES.ADMIN_ROLES.includes(requestedRole)) {
      // Only SuperAdmin can create Admin
      if (!createdBy) {
        return res.status(403).json({
          success: false,
          message: 'Admin role can only be created by SuperAdmin'
        });
      }
      canCreate = true;
      initialStatus = 'Approved';
      requiresApproval = false;
    }
    else if (REGISTRATION_RULES.SUPERADMIN_ROLES.includes(requestedRole)) {
      // Only SuperAdmin can create SuperAdmin
      if (!createdBy) {
        return res.status(403).json({
          success: false,
          message: 'SuperAdmin role can only be created by existing SuperAdmin'
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

// FIXED: Admin/Manager endpoint to create staff users
const createStaffUser = async (req, res) => {
  try {
    const creator = req.user;
    
    // FIXED: Enhanced permission verification
    if (!['SuperAdmin', 'Admin', 'Manager'].includes(creator.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only SuperAdmin, Admin, or Manager can create staff users'
      });
    }

    const { role, name, email, password } = req.body;

    // FIXED: Validate required fields for staff creation
    if (!role || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Role, name, email, and password are required for staff creation'
      });
    }

    // FIXED: Use the canCreateRole function for proper validation
    if (!canCreateRole(creator.role, role)) {
      const allowedRoles = [];
      if (creator.role === 'SuperAdmin') {
        allowedRoles.push(...REGISTRATION_RULES.STAFF_ROLES, ...REGISTRATION_RULES.ADMIN_ROLES);
      } else if (creator.role === 'Admin') {
        allowedRoles.push(...REGISTRATION_RULES.STAFF_ROLES);
      } else if (creator.role === 'Manager') {
        allowedRoles.push('Sales', 'Support');
      }
      
      return res.status(403).json({
        success: false,
        message: `${creator.role} cannot assign ${role} role`,
        allowedRoles: allowedRoles
      });
    }

    // FIXED: Call the main register function with createdBy flag
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

const checkStatus = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    const user = await User.findOne({
      where: { email },
      attributes: ['id', 'name', 'email', 'role', 'status']
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check user status' 
    });
  }
};

const resendApproval = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.status === 'Approved') {
      return res.status(400).json({ 
        success: false, 
        message: 'Account is already approved' 
      });
    }

    if (user.status === 'Rejected') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot resend approval for rejected account' 
      });
    }

    res.json({
      success: true,
      message: 'Approval request sent to admin. You will be notified once approved.',
      status: user.status
    });
  } catch (error) {
    console.error('Resend approval error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to resend approval request' 
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = { ...req.body };

    // Don't allow role/status changes through this endpoint
    delete updates.role;
    delete updates.status;
    delete updates.createdBy;

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    // Remove undefined values
    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key]
    );

    const [updated] = await User.update(updates, { where: { id: userId } });

    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update profile' 
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [{ model: UserType, as: 'userType', attributes: ['id', 'name'] }]
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({ 
      success: true, 
      user 
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get user profile' 
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Generate OTP for password reset
    const otp = generateOTP();
    otpStore.set(email, { 
      otp, 
      userId: user.id, 
      expires: Date.now() + 10 * 60 * 1000 // 10-minute expiry
    });

    await sendOTP(email, otp);

    res.json({
      success: true,
      message: 'OTP for password reset sent to your email.',
      otpSent: true
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send password reset OTP' 
    });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    const storedOTP = otpStore.get(email);
    if (!storedOTP) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP not found or expired' 
      });
    }

    if (storedOTP.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    if (Date.now() > storedOTP.expires) {
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    // Generate a reset token to allow password reset
    const resetToken = jwt.sign(
      { id: storedOTP.userId }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '1h' }
    );
    
    // Clean up OTP
    otpStore.delete(email);

    res.json({
      success: true,
      message: 'OTP verified successfully. Use the reset token to change your password.',
      resetToken
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'OTP verification failed' 
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reset token and new password are required' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'secret');
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [updated] = await User.update(
      { password: hashedPassword }, 
      { where: { id: decoded.id } }
    );

    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Password reset successfully. You can now login with your new password.' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Password reset failed' 
    });
  }
};

// NEW: Create SuperAdmin function (for initial setup via API)
const createSuperAdmin = async (req, res) => {
  try {
    const { name, email, password, secretKey } = req.body;

    // SECURITY: Require secret key for SuperAdmin creation
    if (secretKey !== process.env.SUPERADMIN_SECRET_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Invalid secret key for SuperAdmin creation'
      });
    }

    // Check if SuperAdmin already exists
    const existingSuperAdmin = await User.findOne({ 
      where: { role: 'SuperAdmin' } 
    });

    if (existingSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'SuperAdmin already exists. Use existing SuperAdmin to create more.'
      });
    }

    // Create SuperAdmin
    const hashedPassword = await bcrypt.hash(password, 12);
    
    let defaultUserType = await UserType.findOne({ where: { name: 'SuperAdmin' } });
    if (!defaultUserType) {
      defaultUserType = await UserType.create({
        name: 'SuperAdmin',
        description: 'Super Administrator - Developer access',
        isActive: true
      });
    }

    const superAdmin = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'SuperAdmin',
      status: 'Approved',
      userTypeId: defaultUserType.id
    });

    res.status(201).json({
      success: true,
      message: 'SuperAdmin created successfully',
      data: {
        userId: superAdmin.id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role,
        status: superAdmin.status
      }
    });

  } catch (error) {
    console.error('Create SuperAdmin error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
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
  createSuperAdmin, // NEW
  REGISTRATION_RULES, // Export for use in other modules
  ROLE_HIERARCHY, // Export for use in other modules
  canCreateRole // Export helper function
};