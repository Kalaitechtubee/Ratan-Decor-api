// routes/userType.js - Updated without express-validator
const express = require('express');
const router = express.Router();
const userTypeController = require('./controller'); 
const { authenticateToken, moduleAccess } = require('../middleware/auth');
const { sanitizeInput, auditLogger, rateLimits } = require('../middleware/security');
const { uploadUserTypeIcon, handleUploadError } = require('../middleware/upload');

router.get('/', userTypeController.getAllUserTypes);
router.get('/:id', userTypeController.getUserTypeById);

router.post('/',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  uploadUserTypeIcon,
  handleUploadError,
  auditLogger,
  rateLimits.general,
  userTypeController.createUserType
);

router.put('/:id',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireManagerOrAdmin, // SuperAdmin/Admin included
  uploadUserTypeIcon,
  handleUploadError,
  auditLogger,
  rateLimits.general,
  userTypeController.updateUserType
);

router.delete('/:id',
  authenticateToken,
  sanitizeInput,
  moduleAccess.requireAdmin, // SuperAdmin/Admin (Admin explicit)
  auditLogger,
  rateLimits.general,
  userTypeController.deleteUserType
);

module.exports = router;