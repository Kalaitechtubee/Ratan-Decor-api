// kalai
const { Slider, sequelize } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const { generateImageUrl } = require('../utils/imageUtils');

// Helper to safely parse images
const safeParseImages = (data) => {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

// Helper function to cleanup files
const cleanupFiles = async (filenames, uploadDir) => {
  if (!Array.isArray(filenames) || filenames.length === 0) return;

  await Promise.all(
    filenames.map(async (filename) => {
      if (!filename) return;
      const filePath = path.join(uploadDir, filename);
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        console.log(`✅ Deleted file: ${filename}`);
      } catch (err) {
        console.warn(`⚠️ Cleanup failed for ${filename}:`, err.message);
      }
    })
  );
};

// Get all sliders (public endpoint)
const getAllSliders = async (req, res) => {
  try {
    const { activeOnly = 'true' } = req.query;
    const whereClause = activeOnly === 'true' ? { isActive: true } : {};

    const sliders = await Slider.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });

    const slidersWithUrls = sliders.map(slider => {
      const images = safeParseImages(slider.images);
      return {
        id: slider.id,
        subtitle: slider.subtitle,
        title: slider.title,
        desc: slider.desc,
        cta: slider.cta,
        ctaUrl: slider.ctaUrl,
        image: images[0] || null, // First image for backward compatibility
        images: images.map(img => ({
          filename: img,
          url: generateImageUrl(img, req, 'sliders')
        })),
        isActive: slider.isActive,
        createdAt: slider.createdAt,
        updatedAt: slider.updatedAt,
      };
    });

    res.json({
      success: true,
      sliders: slidersWithUrls,
      total: slidersWithUrls.length,
    });
  } catch (err) {
    console.error('Error fetching sliders:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sliders',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// Get a single slider by ID
const getSliderById = async (req, res) => {
  try {
    const { id } = req.params;
    const sliderId = parseInt(id, 10);

    if (isNaN(sliderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid slider ID',
      });
    }

    const slider = await Slider.findByPk(sliderId);

    if (!slider) {
      return res.status(404).json({
        success: false,
        message: 'Slider not found',
      });
    }

    const images = safeParseImages(slider.images);

    res.json({
      success: true,
      slider: {
        id: slider.id,
        subtitle: slider.subtitle,
        title: slider.title,
        desc: slider.desc,
        cta: slider.cta,
        ctaUrl: slider.ctaUrl,
        image: images[0] || null,
        images: images.map(img => ({
          filename: img,
          url: generateImageUrl(img, req, 'sliders')
        })),
        isActive: slider.isActive,
        createdAt: slider.createdAt,
        updatedAt: slider.updatedAt,
      },
    });
  } catch (err) {
    console.error('Error fetching slider:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch slider',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// Create a new slider
const createSlider = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { subtitle, title, desc, cta, ctaUrl, isActive } = req.body;

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    // Handle image uploads
    let imageFilenames = [];
    if (req.files && req.files.images) {
      const uploadedFiles = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];

      imageFilenames = uploadedFiles
        .slice(0, 5) // Limit to 5 images
        .map(file => file.filename);
    }

    const slider = await Slider.create({
      subtitle: subtitle?.trim() || null,
      title: title.trim(),
      desc: desc?.trim() || null,
      cta: cta?.trim() || null,
      ctaUrl: ctaUrl?.trim() || null,
      images: imageFilenames,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    }, { transaction });

    await transaction.commit();

    const images = safeParseImages(slider.images);

    res.status(201).json({
      success: true,
      message: 'Slider created successfully',
      slider: {
        id: slider.id,
        subtitle: slider.subtitle,
        title: slider.title,
        desc: slider.desc,
        cta: slider.cta,
        ctaUrl: slider.ctaUrl,
        image: images[0] || null,
        images: images.map(img => ({
          filename: img,
          url: generateImageUrl(img, req, 'sliders')
        })),
        isActive: slider.isActive,
        createdAt: slider.createdAt,
        updatedAt: slider.updatedAt,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error creating slider:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create slider',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// Update a slider
const updateSlider = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { subtitle, title, desc, cta, ctaUrl, isActive, existingImages } = req.body;

    const sliderId = parseInt(id, 10);
    if (isNaN(sliderId)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid slider ID',
      });
    }

    const slider = await Slider.findByPk(sliderId, { transaction });

    if (!slider) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Slider not found',
      });
    }

    let updateData = {};
    let hasChanges = false;
    const uploadDir = path.join(__dirname, '..', 'uploads', 'sliders');
    const currentImages = safeParseImages(slider.images);

    // Handle title update
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Title cannot be empty',
        });
      }
      const trimmedTitle = title.trim();
      if (trimmedTitle !== slider.title) {
        updateData.title = trimmedTitle;
        hasChanges = true;
      }
    }

    // Handle subtitle update
    if (subtitle !== undefined) {
      const newSubtitle = subtitle?.trim() || null;
      if (newSubtitle !== slider.subtitle) {
        updateData.subtitle = newSubtitle;
        hasChanges = true;
      }
    }

    // Handle desc update
    if (desc !== undefined) {
      const newDesc = desc?.trim() || null;
      if (newDesc !== slider.desc) {
        updateData.desc = newDesc;
        hasChanges = true;
      }
    }

    // Handle cta update
    if (cta !== undefined) {
      const newCta = cta?.trim() || null;
      if (newCta !== slider.cta) {
        updateData.cta = newCta;
        hasChanges = true;
      }
    }

    // Handle ctaUrl update
    if (ctaUrl !== undefined) {
      const newCtaUrl = ctaUrl?.trim() || null;
      if (newCtaUrl !== slider.ctaUrl) {
        updateData.ctaUrl = newCtaUrl;
        hasChanges = true;
      }
    }

    // Handle isActive update
    if (isActive !== undefined) {
      const newIsActive = Boolean(isActive);
      if (newIsActive !== slider.isActive) {
        updateData.isActive = newIsActive;
        hasChanges = true;
      }
    }

    // Handle images update
    let finalImages = currentImages;

    // Parse existing images from request (if provided)
    let existingImagesArray = [];
    if (existingImages) {
      try {
        existingImagesArray = typeof existingImages === 'string'
          ? JSON.parse(existingImages)
          : existingImages;
        if (!Array.isArray(existingImagesArray)) {
          existingImagesArray = [];
        }
      } catch (e) {
        existingImagesArray = [];
      }
    } else {
      existingImagesArray = currentImages;
    }

    // Get new uploaded files
    let newImageFilenames = [];
    if (req.files && req.files.images) {
      const uploadedFiles = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];
      newImageFilenames = uploadedFiles.map(file => file.filename);
    }

    // Combine existing and new images (limit to 5 total)
    finalImages = [...existingImagesArray, ...newImageFilenames].slice(0, 5);

    // Find images to delete (images that were removed)
    const imagesToDelete = currentImages.filter(img => !finalImages.includes(img));

    if (JSON.stringify(finalImages.sort()) !== JSON.stringify(currentImages.sort())) {
      updateData.images = finalImages;
      hasChanges = true;

      // Cleanup deleted images
      if (imagesToDelete.length > 0) {
        await cleanupFiles(imagesToDelete, uploadDir);
      }
    }

    if (!hasChanges) {
      await transaction.rollback();
      const images = safeParseImages(slider.images);
      return res.status(200).json({
        success: true,
        message: 'No changes detected',
        slider: {
          id: slider.id,
          subtitle: slider.subtitle,
          title: slider.title,
          desc: slider.desc,
          cta: slider.cta,
          ctaUrl: slider.ctaUrl,
          image: images[0] || null,
          images: images.map(img => ({
            filename: img,
            url: generateImageUrl(img, req, 'sliders')
          })),
          isActive: slider.isActive,
          createdAt: slider.createdAt,
          updatedAt: slider.updatedAt,
        },
      });
    }

    await slider.update(updateData, { transaction });
    await transaction.commit();

    const updatedSlider = await Slider.findByPk(sliderId);
    const images = safeParseImages(updatedSlider.images);

    res.json({
      success: true,
      message: 'Slider updated successfully',
      slider: {
        id: updatedSlider.id,
        subtitle: updatedSlider.subtitle,
        title: updatedSlider.title,
        desc: updatedSlider.desc,
        cta: updatedSlider.cta,
        ctaUrl: updatedSlider.ctaUrl,
        image: images[0] || null,
        images: images.map(img => ({
          filename: img,
          url: generateImageUrl(img, req, 'sliders')
        })),
        isActive: updatedSlider.isActive,
        createdAt: updatedSlider.createdAt,
        updatedAt: updatedSlider.updatedAt,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error updating slider:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update slider',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// Delete a slider
const deleteSlider = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const sliderId = parseInt(id, 10);

    if (isNaN(sliderId)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid slider ID',
      });
    }

    const slider = await Slider.findByPk(sliderId, { transaction });

    if (!slider) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Slider not found',
      });
    }

    // Cleanup images
    const images = safeParseImages(slider.images);
    if (images.length > 0) {
      const uploadDir = path.join(__dirname, '..', 'uploads', 'sliders');
      await cleanupFiles(images, uploadDir);
    }

    await slider.destroy({ transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: 'Slider deleted successfully',
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Error deleting slider:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete slider',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

module.exports = {
  getAllSliders,
  getSliderById,
  createSlider,
  updateSlider,
  deleteSlider,
};