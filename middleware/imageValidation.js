const validateImage = (req, res, next) => {
  // Check if we have either single image or multiple images
  if (!req.file && (!req.files || req.files.length === 0)) {
    return res.status(400).json({ message: 'Image file is required' });
  }

  // Validate single image
  if (req.file) {
    // Check file size (10MB limit)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ message: 'Image file size must be less than 10MB' });
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        message: 'Only JPEG, JPG, PNG, and WebP images are allowed' 
      });
    }
  }

  // Validate multiple images
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ 
          message: `Image file ${file.originalname} size must be less than 10MB` 
        });
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ 
          message: `Only JPEG, JPG, PNG, and WebP images are allowed. File ${file.originalname} has type: ${file.mimetype}` 
        });
      }
    }
  }

  next();
};

module.exports = { validateImage };



