

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
const uploadDirs = {
  products: path.join(uploadDir, 'products'),
  categories: path.join(uploadDir, 'categories'),
  userTypes: path.join(uploadDir, 'userTypes'),
  sliders: path.join(uploadDir, 'sliders'),

  defaults: path.join(uploadDir, 'defaults'),
  catalog: path.join(uploadDir, 'catalog')
};

Object.entries(uploadDirs).forEach(([name, dir]) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    console.log(`✅ Created directory: ${name} at ${dir}`);
  } else {
    console.log(`📁 Directory exists: ${name} at ${dir}`);
  }
});

const uploadConfigs = {
  products: {
    path: uploadDirs.products,
    prefix: 'product',
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 11
  },
  categories: {
    path: uploadDirs.categories,
    prefix: 'category',
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1
  },
  userTypes: {
    path: uploadDirs.userTypes,
    prefix: 'userType',
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'],
    maxSize: 2 * 1024 * 1024, // 2MB
    maxFiles: 1
  },
  sliders: {
    path: uploadDirs.sliders,
    prefix: 'slider',
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5
  },
  catalog: {
    path: uploadDirs.catalog,
    prefix: 'catalog',
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 1
  }
};

const createStorage = (type) => {
  const config = uploadConfigs[type];

  return multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(config.path)) {
        fs.mkdirSync(config.path, { recursive: true, mode: 0o755 });
      }
      cb(null, config.path);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `${config.prefix}-${uniqueSuffix}${ext}`;
      cb(null, filename);
    }
  });
};


const createFileFilter = (type) => {
  const config = uploadConfigs[type];

  return (req, file, cb) => {
    if (config.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: ${config.allowedTypes.join(', ')}`
      );
      error.code = 'INVALID_FILE_TYPE';
      cb(error, false);
    }
  };
};

const uploaders = {
  products: multer({
    storage: createStorage('products'),
    fileFilter: createFileFilter('products'),
    limits: {
      fileSize: uploadConfigs.products.maxSize,
      files: uploadConfigs.products.maxFiles
    }
  }),
  categories: multer({
    storage: createStorage('categories'),
    fileFilter: createFileFilter('categories'),
    limits: {
      fileSize: uploadConfigs.categories.maxSize,
      files: uploadConfigs.categories.maxFiles
    }
  }),
  userTypes: multer({
    storage: createStorage('userTypes'),
    fileFilter: createFileFilter('userTypes'),
    limits: {
      fileSize: uploadConfigs.userTypes.maxSize,
      files: uploadConfigs.userTypes.maxFiles
    }
  }),
  sliders: multer({
    storage: createStorage('sliders'),
    fileFilter: createFileFilter('sliders'),
    limits: {
      fileSize: uploadConfigs.sliders.maxSize,
      files: uploadConfigs.sliders.maxFiles
    }
  }),
  catalog: multer({
    storage: createStorage('catalog'),
    fileFilter: createFileFilter('catalog'),
    limits: {
      fileSize: uploadConfigs.catalog.maxSize,
      files: uploadConfigs.catalog.maxFiles
    }
  })
};



const uploadProductImages = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }

  uploaders.products.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum 10MB per file.',
          error: 'FILE_TOO_LARGE'
        });
      }
      return next(err);
    }
    next();
  });
};


const uploadCategoryImage = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }

  uploaders.categories.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum 5MB.',
          error: 'FILE_TOO_LARGE'
        });
      }
      return next(err);
    }
    next();
  });
};


const uploadUserTypeIcon = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }

  uploaders.userTypes.single('icon')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum 2MB.',
          error: 'FILE_TOO_LARGE'
        });
      }
      return next(err);
    }
    next();
  });
};

const uploadSliderImages = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }

  uploaders.sliders.fields([
    { name: 'images', maxCount: 5 }
  ])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum 10MB per file.',
          error: 'FILE_TOO_LARGE'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 5 images allowed.',
          error: 'TOO_MANY_FILES'
        });
      }
      return next(err);
    }
    next();
  });
};

const uploadCatalogFile = (req, res, next) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }

  uploaders.catalog.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum 50MB.',
          error: 'FILE_TOO_LARGE'
        });
      }
      return next(err);
    }
    next();
  });
};

const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const errorResponses = {
      LIMIT_FILE_SIZE: {
        success: false,
        message: 'File too large',
        error: 'FILE_TOO_LARGE',
        maxSize: '10MB for products, 5MB for categories, 2MB for user types'
      },
      LIMIT_FILE_COUNT: {
        success: false,
        message: 'Too many files',
        error: 'TOO_MANY_FILES',
        maxFiles: '1 main image + 10 additional images for products'
      },
      LIMIT_UNEXPECTED_FILE: {
        success: false,
        message: `Unexpected file field: ${error.field}`,
        error: 'UNEXPECTED_FIELD',
        expectedFields: 'image, images (for products); image (for categories); icon (for user types)'
      }
    };

    const response = errorResponses[error.code] || {
      success: false,
      message: `Upload error: ${error.message}`,
      error: 'UPLOAD_ERROR'
    };

    return res.status(400).json(response);
  }

  if (error.message?.includes('Invalid file type') || error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: 'INVALID_FILE_TYPE',
      allowedTypes: 'Images (JPEG, PNG, WEBP, SVG) or Documents (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV)'
    });
  }

  if (error.message) {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: 'GENERAL_UPLOAD_ERROR'
    });
  }

  next(error);
};



/**
 * Generate full URL for uploaded image
 * @param {string} filename - The filename stored in database
 * @param {object} req - Express request object
 * @param {string} imageType - Type of image (products, categories, userTypes)
 * @returns {string|null} Full URL to the image
 */
const generateImageUrl = (filename, req, imageType = 'products') => {
  if (!filename || typeof filename !== 'string') return null;

  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }

  if (filename.startsWith('/uploads/')) {
    const baseUrl = process.env.BASE_URL?.trim() || `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}${filename}`;
  }

  const baseUrl = process.env.BASE_URL?.trim() || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${imageType}/${filename}`;
};

/**
 * Process uploaded files from multer
 * @param {object} files - req.files object from multer
 * @returns {object} Processed file data with filenames
 */
const processUploadedFiles = (files) => {
  const result = { image: null, images: [] };

  if (files) {
    if (files.image?.[0]) {
      result.image = files.image[0].filename;
    }
    if (files.images?.length) {
      result.images = files.images.map(f => f.filename);
    }
  }

  return result;
};

/**
 * Delete file from filesystem
 * @param {string} filename - Filename to delete (can be full URL or just filename)
 * @param {string} type - Directory type (products, categories, userTypes)
 */
const deleteFile = (filename, type = 'products') => {
  if (!filename) return false;

  try {
    let actualFilename = filename;
    if (filename.includes('/uploads/')) {
      actualFilename = filename.split('/uploads/')[1].split('/').pop();
    }

    const filePath = path.join(uploadDirs[type], actualFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Delete multiple files
 * @param {array} filenames - Array of filenames to delete
 * @param {string} type - Directory type
 */
const deleteFiles = (filenames, type = 'products') => {
  if (!Array.isArray(filenames)) return;

  filenames.forEach(filename => deleteFile(filename, type));
};

/**
 * Check if file exists
 * @param {string} filename - Filename to check
 * @param {string} type - Directory type
 * @returns {boolean} True if file exists
 */
const fileExists = (filename, type = 'products') => {
  if (!filename) return false;

  try {
    let actualFilename = filename;
    if (filename.includes('/uploads/')) {
      actualFilename = filename.split('/uploads/')[1].split('/').pop();
    }

    const filePath = path.join(uploadDirs[type], actualFilename);
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  // Middleware
  uploadProductImages,
  uploadCategoryImage,
  uploadUserTypeIcon,
  uploadSliderImages,
  uploadCatalogFile,
  handleUploadError,

  // Utilities
  generateImageUrl,
  processUploadedFiles,
  deleteFile,
  deleteFiles,
  fileExists,

  // Directory paths
  uploadDirs,
  uploadDir,

  // Configs
  uploadConfigs,

  // Legacy aliases for backward compatibility
  uploadFields: uploadProductImages,
  productImagesDir: uploadDirs.products,
  categoryImagesDir: uploadDirs.categories,
  userTypeIconsDir: uploadDirs.userTypes,
  sliderImagesDir: uploadDirs.sliders
};
