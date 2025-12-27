const Catalog = require('./model');
const { generateImageUrl, deleteFile } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

/**
 * Upload or replace the catalog file
 * Singleton pattern: Only one catalog file exists at a time
 */
exports.uploadCatalog = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const { filename, originalname, path: filePath, mimetype, size } = req.file;

        // Check if a catalog already exists
        let catalog = await Catalog.findOne();

        if (catalog) {
            // Delete old file if it exists
            if (catalog.filename) {
                deleteFile(catalog.filename, 'catalog');
            }

            // Update existing record
            catalog.filename = filename;
            catalog.originalName = originalname;
            catalog.path = filePath;
            catalog.mimeType = mimetype;
            catalog.size = size;
            await catalog.save();
        } else {
            // Create new record
            catalog = await Catalog.create({
                filename,
                originalName: originalname,
                path: filePath,
                mimeType: mimetype,
                size
            });
        }

        const fileUrl = generateImageUrl(filename, req, 'catalog');

        res.status(200).json({
            success: true,
            message: 'Catalog uploaded successfully',
            catalog: {
                ...catalog.toJSON(),
                url: fileUrl
            }
        });

    } catch (error) {
        console.error('Upload catalog error:', error);
        // Try to delete the uploaded file if DB operation failed
        if (req.file) {
            deleteFile(req.file.filename, 'catalog');
        }
        res.status(500).json({
            success: false,
            message: 'Error uploading catalog',
            error: error.message
        });
    }
};

/**
 * Get current catalog details
 */
exports.getCatalog = async (req, res) => {
    try {
        const catalog = await Catalog.findOne();

        if (!catalog) {
            return res.status(404).json({
                success: false,
                message: 'No catalog found'
            });
        }

        const fileUrl = generateImageUrl(catalog.filename, req, 'catalog');

        res.status(200).json({
            success: true,
            catalog: {
                ...catalog.toJSON(),
                url: fileUrl
            }
        });

    } catch (error) {
        console.error('Get catalog error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching catalog',
            error: error.message
        });
    }
};

/**
 * Delete catalog
 */
exports.deleteCatalog = async (req, res) => {
    try {
        const catalog = await Catalog.findOne();

        if (!catalog) {
            return res.status(404).json({
                success: false,
                message: 'No catalog found to delete'
            });
        }

        // Delete file from filesystem
        deleteFile(catalog.filename, 'catalog');

        // Remove from DB
        await catalog.destroy();

        res.status(200).json({
            success: true,
            message: 'Catalog deleted successfully'
        });

    } catch (error) {
        console.error('Delete catalog error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting catalog',
            error: error.message
        });
    }
};
