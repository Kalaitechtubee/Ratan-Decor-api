
// middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    // Check if user is approved
    if (user.status !== 'Approved') {
      return res.status(403).json({ 
        message: 'Account not approved. Please wait for admin approval.',
        status: user.status
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

// Role-based middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Admin middleware
const requireAdmin = requireRole(['Admin', 'Manager']);

// Architect/Dealer middleware
const requireApprovedRole = requireRole(['Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support']);

module.exports = { 
  authMiddleware, 
  requireRole, 
  requireAdmin, 
  requireApprovedRole 
};
