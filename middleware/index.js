// middleware/index.js

// Import middleware functions from individual files
const { authenticateToken: authMiddleware, authorizeRoles: requireRole, requireAdmin, requireApprovedRole } = require('./auth');
const { uploadFields, handleUploadError, productImagesDir } = require('./upload');
const { validateImage } = require('./imageValidation');

// Export all middleware functions
module.exports = {
  authMiddleware,
  requireRole,
  requireAdmin,
  requireApprovedRole,
  uploadFields,
  handleUploadError,
  productImagesDir,
  validateImage,
  // Aliases
  uploadSingle: uploadFields, // This might need to be adjusted if uploadSingle is different from uploadFields
  uploadMultiple: uploadFields, // Adding alias for uploadMultiple
};