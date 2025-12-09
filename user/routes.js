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

const { rateLimits } = require('../middleware/security');


router.use(authenticateToken);


router.use(rateLimits.general);


router.post('/',
  moduleAccess.requireAdmin,
  createUser
);


router.get('/',
  moduleAccess.requireAdmin,
  getAllUsers
);


router.get('/staff',
  moduleAccess.requireStaffAccess,
  getAllStaffUsers
);


router.get('/:id',
  requireOwnDataOrStaff,
  getUserById
);


router.get('/staff/:id',
  moduleAccess.requireStaffAccess,
  getStaffUserById
);

router.put('/:id',
  requireOwnDataOrStaff,   
  updateUser
);


router.delete('/:id',
  moduleAccess.requireAdmin,
  deleteUser
);


router.get('/:id/orders',
  requireOwnDataOrStaff,
  getUserOrderHistory
);


router.get('/orders/full',
  moduleAccess.requireAdmin,
  getFullOrderHistory
);

module.exports = router;
