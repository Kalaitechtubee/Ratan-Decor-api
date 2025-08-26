const jwt = require('jsonwebtoken');
const { User, UserType } = require('../models');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.replace('Bearer ', '') 
      : null;

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const userId = decoded.id || decoded.sub || decoded.userId;

    if (!userId) {
      console.log('No user ID in token payload:', decoded);
      return res.status(401).json({
        success: false,
        message: 'Invalid token. No user ID found.',
      });
    }

    // Find user with userType
    const user = await User.findByPk(userId, {
      include: [
        {
          model: UserType,
          as: 'userType',
          attributes: ['id', 'name', 'isActive'],
          required: false,
        },
      ],
    });

    if (!user) {
      console.log(`User not found for ID: ${userId}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
      });
    }

    // Handle missing userType
    if (!user.userTypeId || !user.userType) {
      console.warn(`User ${user.id} has no userType. Assigning default "General".`);
      let defaultType = await UserType.findOne({ where: { name: 'General' } });
      
      if (!defaultType) {
        defaultType = await UserType.create({
          name: 'General',
          description: 'Default user type',
          isActive: true,
        });
      }
      
      await user.update({ userTypeId: defaultType.id });
      user.userType = defaultType;
    }

    // Check user status for non-admin routes
    if (user.role !== 'Admin' && user.status !== 'Approved') {
      console.log(`User ${user.id} is not approved. Status: ${user.status}`);
      return res.status(403).json({
        success: false,
        message: 'Account not approved. Please wait for admin approval.',
        status: user.status,
      });
    }

    // Set user information in request
    req.user = {
      userId: user.id,
      userTypeId: user.userTypeId,
      role: user.role || 'User',
      email: user.email,
      name: user.name,
      userTypeName: user.userType?.name || 'General',
      status: user.status
    };
    
    req.token = token;

    console.log('Auth successful - User:', {
      id: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status
    });

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format.',
      });
    }

    res.status(401).json({
      success: false,
      message: `Authentication failed: ${error.message}`,
    });
  }
};

const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log('No user in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log(`User ${req.user.userId} has role ${req.user.role}, required: ${allowedRoles}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Convenience middlewares
const requireAdmin = authorizeRoles(['Admin']);
const requireManagerOrAdmin = authorizeRoles(['Admin', 'Manager']);
const requireApprovedRole = authorizeRoles(['Admin', 'Manager', 'Sales', 'Support', 'Architect', 'Dealer']);

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  requireManagerOrAdmin,
  requireApprovedRole,
};