const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
const userTypeIconsDir = path.join(uploadDir, 'userTypes');

// Ensure directories exist
[uploadDir, userTypeIconsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Configure storage for user type icons
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(`Saving user type icon to: ${userTypeIconsDir}`);
    cb(null, userTypeIconsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = 'userType-' + uniqueSuffix + ext;
    console.log(`Generated filename: ${filename} for original: ${file.originalname}`);
    cb(null, filename);
  }
});

// File filter function for user type icons
const fileFilter = (req, file, cb) => {
  console.log(`Processing user type icon file: ${file.originalname}, mimetype: ${file.mimetype}`);

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    console.log(`User type icon file ${file.originalname} accepted`);
    cb(null, true);
  } else {
    console.log(`User type icon file ${file.originalname} rejected - invalid type: ${file.mimetype}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, JPG, PNG, WebP, and SVG images are allowed!`), false);
  }
};

// Configure multer for user type icons
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit per file for icons
    files: 1 // Maximum 1 file for user type icons
  },
  onError: function(err, next) {
    console.error('User type icon upload error:', err);
    next(err);
  }
});

// Upload middleware for user type icons
const uploadUserTypeIcon = (req, res, next) => {
  console.log('=== USER TYPE ICON UPLOAD MIDDLEWARE DEBUG ===');
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  console.log('Content-Type:', req.headers['content-type']);

  // Check if it's multipart request
  if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
    console.log('Not a multipart request, skipping user type icon file upload processing');
    return next();
  }

  const uploadHandler = upload.single('icon');

  uploadHandler(req, res, function(err) {
    if (err) {
      console.error('User type icon upload error:', err);
      return next(err);
    }

    console.log('User type icon upload processing completed');
    console.log('File processed:', req.file ? req.file.filename : 'none');

    // Log file details
    if (req.file) {
      console.log(`User type icon file: ${req.file.filename} (${req.file.originalname})`);
    }

    next();
  });
};

// Enhanced error handling middleware for user type icon uploads
const handleUserTypeUploadError = (error, req, res, next) => {
  console.error('=== USER TYPE ICON UPLOAD ERROR HANDLER ===');
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
          message: 'File too large. Maximum size is 2MB per file.',
          error: 'FILE_TOO_LARGE',
          maxSize: '2MB'
        });

      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          message: 'Too many files. Maximum is 1 file for user type icons.',
          error: 'TOO_MANY_FILES',
          maxFiles: 1
        });

      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          message: `Unexpected file field: ${error.field}. Expected field is 'icon'.`,
          error: 'UNEXPECTED_FIELD',
          expectedFields: ['icon']
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
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
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
const testUserTypeUploadSetup = (req, res, next) => {
  const issues = [];

  if (!fs.existsSync(uploadDir)) {
    issues.push(`Upload directory does not exist: ${uploadDir}`);
  }

  if (!fs.existsSync(userTypeIconsDir)) {
    issues.push(`User type icons directory does not exist: ${userTypeIconsDir}`);
  }

  try {
    // Test write permissions
    const testFile = path.join(userTypeIconsDir, 'test-write-permission.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (err) {
    issues.push(`No write permission to user type icons directory: ${err.message}`);
  }

  if (issues.length > 0) {
    console.error('User type icon upload setup issues:', issues);
    return res.status(500).json({
      message: 'User type icon upload system configuration error',
      issues: issues
    });
  }

  next();
};

module.exports = {
  uploadUserTypeIcon,
  handleUserTypeUploadError,
  userTypeIconsDir,
  testUserTypeUploadSetup
};
