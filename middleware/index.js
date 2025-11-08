
const {
  authenticateToken,
  authMiddleware,
  authorizeRoles,
  requireRole,
  moduleAccess,
  requireOwnDataOrStaff,
  requireAdmin,
  requireManager,
  requireSales,
  requireSupport
} = require('./auth');

// Import upload middleware
const {
  uploadProductImages,
  uploadCategoryImage,
  uploadUserTypeIcon,
  handleUploadError,
  uploadFields,
  uploadDirs,
  uploadDir,
  productImagesDir,
  categoryImagesDir,
  userTypeIconsDir,
  uploadConfigs,
  generateImageUrl,
  processUploadedFiles,
  deleteFile,
  deleteFiles,
  fileExists
} = require('./upload');

// Import security middleware
const {
  rateLimits,
  trackSuspiciousActivity,
  enhanceLoginSecurity,
  validatePasswordPolicy,
  sanitizeInput,
  sanitizeInputObject,
  auditLogger,
  sessionSecurity,
  secureLogout
} = require('./security');

module.exports = {

  authenticateToken,
  authMiddleware,
  authorizeRoles,
  requireRole,
  moduleAccess,
  requireOwnDataOrStaff,
  requireAdmin,
  requireManager,
  requireSales,
  requireSupport,


  uploadProductImages,
  uploadCategoryImage,
  uploadUserTypeIcon,
  handleUploadError,
  uploadFields,

  rateLimits,
  trackSuspiciousActivity,
  enhanceLoginSecurity,
  validatePasswordPolicy,
  sanitizeInput,
  sanitizeInputObject,
  auditLogger,
  sessionSecurity,
  secureLogout,

 
  uploadDirs,
  uploadDir,
  productImagesDir,
  categoryImagesDir,
  userTypeIconsDir,
  uploadConfigs,


  generateImageUrl,
  processUploadedFiles,
  deleteFile,
  deleteFiles,
  fileExists
};
