// middleware/index.js - Consolidated Middleware Module
// Central export file for all middleware functions
// Imports from specialized middleware files for better organization

// Import authentication and authorization middleware
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

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  // Authentication & Authorization
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

  // Upload middleware
  uploadProductImages,
  uploadCategoryImage,
  uploadUserTypeIcon,
  handleUploadError,
  uploadFields,

  // Security middleware
  rateLimits,
  trackSuspiciousActivity,
  enhanceLoginSecurity,
  validatePasswordPolicy,
  sanitizeInput,
  sanitizeInputObject,
  auditLogger,
  sessionSecurity,
  secureLogout,

  // Directory paths and configs
  uploadDirs,
  uploadDir,
  productImagesDir,
  categoryImagesDir,
  userTypeIconsDir,
  uploadConfigs,

  // Utility functions
  generateImageUrl,
  processUploadedFiles,
  deleteFile,
  deleteFiles,
  fileExists
};
