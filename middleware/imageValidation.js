// middleware/imageValidation.js
const validateImage = (req, res, next) => {
  if (req.files) {
    // Validate single image if present
    if (req.files.image) {
      req.files.image.forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ message: 'Image file size must be less than 10MB' });
        }
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({ 
            message: 'Only JPEG, JPG, PNG, and WebP images are allowed' 
          });
        }
      });
    }

    // Validate multiple images if present
    if (req.files.images) {
      req.files.images.forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ 
            message: `Image file ${file.originalname} size must be less than 10MB` 
          });
        }
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({ 
            message: `Only JPEG, JPG, PNG, and WebP images are allowed. File ${file.originalname} has type: ${file.mimetype}` 
          });
        }
      });
    }
  }

  next();
};

module.exports = { validateImage };