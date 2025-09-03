// middleware/upload.js - Improved with better error handling and debugging
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
const productImagesDir = path.join(uploadDir, 'products');

// Ensure directories exist
[uploadDir, productImagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(`Saving file to: ${productImagesDir}`);
    cb(null, productImagesDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = 'product-' + uniqueSuffix + ext;
    console.log(`Generated filename: ${filename} for original: ${file.originalname}`);
    cb(null, filename);
  }
});

// File filter function with detailed logging
const fileFilter = (req, file, cb) => {
  console.log(`Processing file: ${file.originalname}, mimetype: ${file.mimetype}`);
  
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    console.log(`File ${file.originalname} accepted`);
    cb(null, true);
  } else {
    console.log(`File ${file.originalname} rejected - invalid type: ${file.mimetype}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, JPG, PNG, and WebP images are allowed!`), false);
  }
};

// Configure multer with detailed logging
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 11 // Maximum 11 files (1 main image + 10 additional images)
  },
  onError: function(err, next) {
    console.error('Multer error:', err);
    next(err);
  }
});

// Create upload middleware with detailed logging
const uploadFields = (req, res, next) => {
  console.log('=== UPLOAD MIDDLEWARE DEBUG ===');
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Content-Length:', req.headers['content-length']);
  
  // Check if it's multipart request
  if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
    console.log('Not a multipart request, skipping file upload processing');
    return next();
  }

  const uploadHandler = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]);

  uploadHandler(req, res, function(err) {
    if (err) {
      console.error('Upload error:', err);
      return next(err);
    }

    console.log('Upload processing completed');
    console.log('Files processed:', req.files ? Object.keys(req.files) : 'none');
    console.log('Body keys after upload:', Object.keys(req.body || {}));
    
    // Log file details
    if (req.files) {
      for (const [fieldName, files] of Object.entries(req.files)) {
        console.log(`Field ${fieldName}: ${files.length} files`);
        files.forEach((file, index) => {
          console.log(`  File ${index}: ${file.filename} (${file.originalname})`);
        });
      }
    }

    // Log body content (first 500 chars of each field)
    if (req.body) {
      for (const [key, value] of Object.entries(req.body)) {
        const displayValue = typeof value === 'string' && value.length > 500 
          ? value.substring(0, 500) + '...' 
          : value;
        console.log(`Body field ${key}:`, displayValue);
      }
    }

    next();
  });
};

// Enhanced error handling middleware
const handleUploadError = (error, req, res, next) => {
  console.error('=== UPLOAD ERROR HANDLER ===');
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
          message: 'File too large. Maximum size is 10MB per file.',
          error: 'FILE_TOO_LARGE',
          maxSize: '10MB'
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ 
          message: 'Too many files. Maximum is 11 files total (1 main image + 10 additional images).',
          error: 'TOO_MANY_FILES',
          maxFiles: 11
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          message: `Unexpected file field: ${error.field}. Expected fields are 'image' and 'images'.`,
          error: 'UNEXPECTED_FIELD',
          expectedFields: ['image', 'images']
        });
      
      case 'LIMIT_PART_COUNT':
        return res.status(400).json({ 
          message: 'Too many parts in multipart form.',
          error: 'TOO_MANY_PARTS'
        });
      
      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({ 
          message: 'Field name too long.',
          error: 'FIELD_NAME_TOO_LONG'
        });
      
      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({ 
          message: 'Field value too long.',
          error: 'FIELD_VALUE_TOO_LONG'
        });
      
      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({ 
          message: 'Too many fields in form.',
          error: 'TOO_MANY_FIELDS'
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
const testUploadSetup = (req, res, next) => {
  const issues = [];
  
  if (!fs.existsSync(uploadDir)) {
    issues.push(`Upload directory does not exist: ${uploadDir}`);
  }
  
  if (!fs.existsSync(productImagesDir)) {
    issues.push(`Product images directory does not exist: ${productImagesDir}`);
  }
  
  try {
    // Test write permissions
    const testFile = path.join(productImagesDir, 'test-write-permission.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (err) {
    issues.push(`No write permission to product images directory: ${err.message}`);
  }
  
  if (issues.length > 0) {
    console.error('Upload setup issues:', issues);
    return res.status(500).json({
      message: 'Upload system configuration error',
      issues: issues
    });
  }
  
  next();
};

module.exports = {
  uploadFields,
  handleUploadError,
  productImagesDir,
  testUploadSetup,
  // Export individual upload handlers for flexibility
  uploadSingle: upload.single.bind(upload),
  uploadArray: upload.array.bind(upload),
  uploadAny: upload.any.bind(upload)
};