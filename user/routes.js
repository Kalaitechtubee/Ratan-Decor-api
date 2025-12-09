// routes/user.js - Updated without express-validator
const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getAllStaffUsers,
  getStaffUserById,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserOrderHistory,
  getFullOrderHistory
} = require('./controller');

const {
  authenticateToken,
  moduleAccess,
  requireOwnDataOrStaff
} = require('../middleware/auth');

const { sanitizeInput, rateLimits } = require('../middleware/security');

// ===============================
// Global middlewares
// ===============================
router.use(authenticateToken);
router.use(sanitizeInput);
router.use(rateLimits.general);

router.post('/',
  moduleAccess.requireAdmin, // SuperAdmin/Admin
  createUser
);

router.get('/',
  moduleAccess.requireAdmin, // SuperAdmin/Admin
  getAllUsers
);

router.get('/staff',
  moduleAccess.requireStaffAccess, // SuperAdmin/Admin included
  getAllStaffUsers
);

router.get('/:id',
  requireOwnDataOrStaff, // SuperAdmin/Admin bypass
  getUserById
);

router.get('/staff/:id',
  moduleAccess.requireStaffAccess, // SuperAdmin/Admin included
  getStaffUserById
);

router.put('/:id',
  requireOwnDataOrStaff, // SuperAdmin/Admin bypass
  updateUser
);

router.delete('/:id',
  moduleAccess.requireAdmin, // SuperAdmin/Admin
  deleteUser
);

router.get('/:id/orders',
  requireOwnDataOrStaff, // SuperAdmin/Admin bypass
  getUserOrderHistory
);

router.get('/orders/full',
  moduleAccess.requireAdmin, // SuperAdmin/Admin
  getFullOrderHistory
);

module.exports = router;