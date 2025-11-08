// const express = require('express');
// const router = express.Router();
// const userTypeController = require('./controller');
// const { authenticateToken, moduleAccess } = require('../middleware/auth');
// const { sanitizeInput, auditLogger } = require('../middleware/security');
// const { uploadUserTypeIcon, handleUserTypeUploadError, testUserTypeUploadSetup } = require('../middleware/userTypeUpload');

// /* -------------------------------
//    PUBLIC ROUTES
// --------------------------------*/
// // Anyone can view user types
// router.get('/', userTypeController.getAllUserTypes);
// router.get('/:id', userTypeController.getUserTypeById);

// /* -------------------------------
//    PROTECTED ROUTES (Admin/Manager/SuperAdmin)
// --------------------------------*/

// // Create user type (Admin, Manager, SuperAdmin)
// router.post('/',
//   authenticateToken,
//   sanitizeInput,
//   moduleAccess.requireManagerOrAdmin,
//   auditLogger,
//   uploadUserTypeIcon,
//   handleUserTypeUploadError,
//   userTypeController.createUserType
// );

// // Update user type (Admin, Manager, SuperAdmin)
// router.put('/:id',
//   authenticateToken,
//   sanitizeInput,
//   moduleAccess.requireManagerOrAdmin,
//   auditLogger,
//   uploadUserTypeIcon,
//   handleUserTypeUploadError,
//   userTypeController.updateUserType
// );

// // Delete user type (Admin + SuperAdmin only)
// router.delete('/:id',
//   authenticateToken,
//   sanitizeInput,
//   moduleAccess.requireAdmin,
//   auditLogger,
//   userTypeController.deleteUserType
// );

// module.exports = router;

// userType/routes.js
const express = require('express');
const router = express.Router();
const userTypeController = require('./controller'); // ✅ Changed from '../controllers/userTypeController'
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { sanitizeInput, auditLogger } = require('../middleware/security');
const { uploadUserTypeIcon, handleUploadError } = require('../middleware/upload');

/* -------------------------------
   PUBLIC ROUTES
--------------------------------*/
// Anyone can view user types
router.get('/', userTypeController.getAllUserTypes);
router.get('/:id', userTypeController.getUserTypeById);

/* -------------------------------
   PROTECTED ROUTES (Admin/Manager/SuperAdmin)
--------------------------------*/
// Create user type (Admin, Manager, SuperAdmin)
router.post('/',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireManagerOrAdmin,
  uploadUserTypeIcon,
  handleUploadError,
  auditLogger,
  userTypeController.createUserType
);

// Update user type (Admin, Manager, SuperAdmin)
router.put('/:id',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireManagerOrAdmin,
  uploadUserTypeIcon,
  handleUploadError,
  auditLogger,
  userTypeController.updateUserType
);

// Delete user type (Admin + SuperAdmin only)
router.delete('/:id',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireAdmin,
  auditLogger,
  userTypeController.deleteUserType
);

module.exports = router;