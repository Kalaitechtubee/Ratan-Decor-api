
const express = require('express');
const router = express.Router();
const userTypeController = require('./controller'); 
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { sanitizeInput, auditLogger } = require('../middleware/security');
const { uploadUserTypeIcon, handleUploadError } = require('../middleware/upload');


router.get('/', userTypeController.getAllUserTypes);
router.get('/:id', userTypeController.getUserTypeById);


router.post('/',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireManagerOrAdmin,
  uploadUserTypeIcon,
  handleUploadError,
  auditLogger,
  userTypeController.createUserType
);


router.put('/:id',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireManagerOrAdmin,
  uploadUserTypeIcon,
  handleUploadError,
  auditLogger,
  userTypeController.updateUserType
);


router.delete('/:id',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireAdmin,
  auditLogger,
  userTypeController.deleteUserType
);

module.exports = router;