const express = require('express');
const router = express.Router();

const {
  getAllUsers,
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

const { rateLimits } = require('../middleware/security');

// 🔒 Apply authentication middleware to all routes
router.use(authenticateToken);

// 🚦 Apply rate limiting to all routes
router.use(rateLimits.general);

/* -------------------------------
   USER MANAGEMENT ROUTES
-------------------------------- */

// ➕ Create new user (admin only)
router.post('/',
  moduleAccess.requireAdmin,
  createUser
);

// 📋 Get all users (admin only)
router.get('/',
  moduleAccess.requireAdmin,
  getAllUsers
);

// 👤 Get user by ID (self or admin/staff)
router.get('/:id',
  requireOwnDataOrStaff,   // ✅ allows user to fetch own data OR staff/admin to fetch any
  getUserById
);

// ✏️ Update user (self or admin/staff)
router.put('/:id',
  requireOwnDataOrStaff,   // ✅ allows user to update own account OR staff/admin to update any
  updateUser
);

// ❌ Delete user (admin only)
router.delete('/:id',
  moduleAccess.requireAdmin,
  deleteUser
);

/* -------------------------------
   ORDER HISTORY ROUTES
-------------------------------- */

// 📦 Get order history for a user (self or admin/staff)
router.get('/:id/orders',
  requireOwnDataOrStaff,
  getUserOrderHistory
);

// 📦 Get full order history (admin only)
router.get('/orders/full',
  moduleAccess.requireAdmin,
  getFullOrderHistory
);

module.exports = router;
