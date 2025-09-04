const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, createUser, updateUser, deleteUser, getUserOrderHistory, getFullOrderHistory } = require('./controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');
const { rateLimits } = require('../middleware/security');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Apply rate limiting to all routes
router.use(rateLimits.general);

// User management routes with proper role restrictions
router.post('/', 
  moduleAccess.requireAdmin, 
  createUser
);

router.get('/', 
  moduleAccess.requireAdmin, 
  getAllUsers
);

router.get('/:id', 
  moduleAccess.requireAdmin, 
  requireOwnDataOrStaff, 
  getUserById
);

router.put('/:id', 
  moduleAccess.requireAdmin, 
  requireOwnDataOrStaff, 
  updateUser
);

router.delete('/:id',
  moduleAccess.requireAdmin,
  deleteUser
);

// Order history routes
router.get('/:id/orders',
  requireOwnDataOrStaff,
  getUserOrderHistory
);

router.get('/orders/full',
  moduleAccess.requireAdmin,
  getFullOrderHistory
);

module.exports = router;
