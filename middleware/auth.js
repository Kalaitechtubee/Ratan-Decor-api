const jwt = require('jsonwebtoken');
const { User, UserType } = require('../models');
const { initializeCategoriesForUserType } = require('../utils/initializeCategories');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const userId = decoded.id || decoded.sub;

    if (!userId) {
      console.log('No user ID in token payload:', decoded);
      return res.status(401).json({
        success: false,
        message: 'Invalid token. No user ID found.',
      });
    }

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

    if (!user.userTypeId || !user.userType) {
      console.warn(`User ${user.id} has no userType. Assigning default "General".`);
      let defaultType = await UserType.findOne({ where: { name: 'General' } });
      if (!defaultType) {
        defaultType = await UserType.create({
          name: 'General',
          description: 'Default user type',
          isActive: true,
        });
        await initializeCategoriesForUserType(defaultType.id);
      }
      await user.update({ userTypeId: defaultType.id });
      user.userType = defaultType;
    }

    if (user.status !== 'Approved') {
      console.log(`User ${user.id} is not approved. Status: ${user.status}`);
      return res.status(403).json({
        success: false,
        message: 'Account not approved. Please wait for admin approval.',
        status: user.status,
      });
    }

    req.user = {
      userId: user.id,
      userTypeId: user.userTypeId,
      role: user.role || 'User',
      email: user.email,
      userTypeName: user.userType.name,
    };
    req.token = token;

    console.log('Auth middleware - req.user:', req.user);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: `Invalid token: ${error.message}`,
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log('No user in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      console.log(`User ${req.user.userId} has role ${req.user.role}, required: ${roles}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

const requireAdmin = requireRole(['Admin', 'Manager']);
const requireApprovedRole = requireRole(['Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support']);

module.exports = {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireApprovedRole,
  authenticateToken: authMiddleware,
  authorizeRoles: requireRole,
};