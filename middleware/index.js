
const {
  authenticateToken,
  authMiddleware,
  authorizeRoles,
  requireRole,
  moduleAccess,
  requireOwnDataOrStaff,
} = require('./auth');

// Create convenience middleware from moduleAccess
const requireAdmin = moduleAccess.requireAdmin;
const requireManagerOrAdmin = moduleAccess.requireManagerOrAdmin;
const requireSalesAccess = moduleAccess.requireSalesAccess;
const requireSupportAccess = moduleAccess.requireSupportAccess;

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
  requireManagerOrAdmin,
  requireSalesAccess,
  requireSupportAccess,

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
