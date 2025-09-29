const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
const categoryImagesDir = path.join(uploadDir, 'categories');

// Ensure directories exist
[uploadDir, categoryImagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Configure storage for categories
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(`Saving category file to: ${categoryImagesDir}`);
    cb(null, categoryImagesDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = 'category-' + uniqueSuffix + ext;
    console.log(`Generated filename: ${filename} for original: ${file.originalname}`);
    cb(null, filename);
  }
});

// File filter function for categories
const fileFilter = (req, file, cb) => {
  console.log(`Processing category file: ${file.originalname}, mimetype: ${file.mimetype}`);

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    console.log(`Category file ${file.originalname} accepted`);
    cb(null, true);
  } else {
    console.log(`Category file ${file.originalname} rejected - invalid type: ${file.mimetype}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, JPG, PNG, and WebP images are allowed!`), false);
  }
};

// Configure multer for categories
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file for categories
    files: 1 // Maximum 1 file for categories
  },
  onError: function(err, next) {
    console.error('Category upload error:', err);
    next(err);
  }
});

// Upload middleware for categories
const uploadCategoryImage = (req, res, next) => {
  console.log('=== CATEGORY UPLOAD MIDDLEWARE DEBUG ===');
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  console.log('Content-Type:', req.headers['content-type']);

  // Check if it's multipart request
  if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
    console.log('Not a multipart request, skipping category file upload processing');
    return next();
  }

  const uploadHandler = upload.single('image');

  uploadHandler(req, res, function(err) {
    if (err) {
      console.error('Category upload error:', err);
      return next(err);
    }

    console.log('Category upload processing completed');
    console.log('File processed:', req.file ? req.file.filename : 'none');

    // Log file details
    if (req.file) {
      console.log(`Category file: ${req.file.filename} (${req.file.originalname})`);
    }

    next();
  });
};

// Enhanced error handling middleware for category uploads
const handleCategoryUploadError = (error, req, res, next) => {
  console.error('=== CATEGORY UPLOAD ERROR HANDLER ===');
  console.error('Error:', error);
  console.error('Error type:', error.constructor.name);

  if (error instanceof multer.MulterError) {
    console.error('Multer error details:', {
      code: error.code,
      field: error.field,
      message: error.message
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          message: 'File too large. Maximum size is 5MB per file.',
          error: 'FILE_TOO_LARGE',
          maxSize: '5MB'
        });

      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          message: 'Too many files. Maximum is 1 file for categories.',
          error: 'TOO_MANY_FILES',
          maxFiles: 1
        });

      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          message: `Unexpected file field: ${error.field}. Expected field is 'image'.`,
          error: 'UNEXPECTED_FIELD',
          expectedFields: ['image']
        });

      default:
        return res.status(400).json({
          message: `Upload error: ${error.message}`,
          error: 'UPLOAD_ERROR',
          code: error.code
        });
    }
  }

  // Handle custom file filter errors
  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      message: error.message,
      error: 'INVALID_FILE_TYPE',
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    });
  }

  // Handle other errors
  if (error.message) {
    return res.status(400).json({
      message: error.message,
      error: 'GENERAL_UPLOAD_ERROR'
    });
  }

  // Pass other errors to the next error handler
  next(error);
};

// Test middleware to verify directories
const testCategoryUploadSetup = (req, res, next) => {
  const issues = [];

  if (!fs.existsSync(uploadDir)) {
    issues.push(`Upload directory does not exist: ${uploadDir}`);
  }

  if (!fs.existsSync(categoryImagesDir)) {
    issues.push(`Category images directory does not exist: ${categoryImagesDir}`);
  }

  try {
    // Test write permissions
    const testFile = path.join(categoryImagesDir, 'test-write-permission.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (err) {
    issues.push(`No write permission to category images directory: ${err.message}`);
  }

  if (issues.length > 0) {
    console.error('Category upload setup issues:', issues);
    return res.status(500).json({
      message: 'Category upload system configuration error',
      issues: issues
    });
  }

  next();
};

module.exports = {
  uploadCategoryImage,
  handleCategoryUploadError,
  categoryImagesDir,
  testCategoryUploadSetup
};
