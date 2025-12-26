const { Product, Category, ProductRating, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const path = require('path');
const fs = require('fs').promises;

class ProductService {
    constructor() {
        this.uploadDir = path.join(__dirname, '..', 'uploads', 'products');
    }

    getReqUserRole(req) {
        return req.user?.role || 'General';
    }

    computePrice(product, role) {
        return role.toLowerCase() === 'dealer'
            ? product.dealerPrice
            : role.toLowerCase() === 'architect'
                ? product.architectPrice
                : product.generalPrice;
    }

    validateVisibleTo(visibleTo) {
        if (!Array.isArray(visibleTo) || visibleTo.length === 0) return false;
        return true;
    }

    getImageUrl(filename, req, imageType = 'products') {
        if (!filename || typeof filename !== 'string') return null;
        if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
        if (filename.startsWith('/uploads/')) return filename;
        const envBaseUrl = process.env.BASE_URL?.trim();
        const baseUrl = envBaseUrl || `${req.protocol}://${req.get('host')}`;
        return `${baseUrl}/uploads/${imageType}/${filename}`;
    }

    processProductData(product, req) {
        const rawData = product.toJSON ? product.toJSON() : { ...product };

        // Ensure JSON fields are parsed if they come as strings
        const images = this.safeJsonParse(rawData.images, []);
        const visibleTo = this.safeJsonParse(rawData.visibleTo, []);
        const colors = this.safeJsonParse(rawData.colors, []);
        const specifications = this.safeJsonParse(rawData.specifications, {});

        // Build image URLs
        const imageUrls = [];
        if (rawData.image) {
            imageUrls.push(this.getImageUrl(rawData.image, req));
        }
        if (images && Array.isArray(images)) {
            images.forEach(img => {
                if (img) imageUrls.push(this.getImageUrl(img, req));
            });
        }

        // CLEAN CATEGORY STRUCTURE
        let category = null;
        if (rawData.category) {
            const cat = rawData.category;
            if (cat.parent) {
                // Product is in a subcategory
                category = {
                    id: cat.id,
                    name: cat.name,
                    parentId: cat.parentId || (cat.parent ? cat.parent.id : null),
                    parent: {
                        id: cat.parent.id,
                        name: cat.parent.name,
                    },
                };
            } else {
                // Product is in a main category (no parent)
                category = {
                    id: cat.id,
                    name: cat.name,
                };
            }
        }

        // BUILD CLEAN RESPONSE
        return {
            id: rawData.id,
            name: rawData.name,
            description: rawData.description || null,

            // CLEAN IMAGE HANDLING - Only URLs, no raw filenames
            imageUrl: imageUrls[0] || null,
            imageUrls: imageUrls.length > 0 ? imageUrls : [],

            // Product details
            brandName: rawData.brandName || null,
            designNumber: rawData.designNumber || null,
            size: rawData.size || null,
            thickness: rawData.thickness || null,
            unitType: rawData.unitType || null,
            colors: colors.length > 0 ? colors : [],
            specifications: specifications && Object.keys(specifications).length > 0
                ? specifications
                : null,

            // Pricing
            mrpPrice: rawData.mrpPrice || null,
            generalPrice: rawData.generalPrice,
            architectPrice: rawData.architectPrice,
            dealerPrice: rawData.dealerPrice,
            gst: rawData.gst || null,

            // Status & visibility
            isActive: rawData.isActive,
            visibleTo: visibleTo || [],

            // Ratings
            averageRating: rawData.averageRating || "0.00",
            totalRatings: rawData.totalRatings || 0,

            // CLEAN CATEGORY - Includes parentId for admin compatibility
            category,
            categoryId: rawData.categoryId,
            subcategoryId: category && category.parentId ? rawData.categoryId : null,

            // Timestamps
            createdAt: rawData.createdAt,
            updatedAt: rawData.updatedAt,
        };
    }

    validateRating(rating) {
        const numRating = Number(rating);
        return !isNaN(numRating) && numRating >= 1 && numRating <= 5;
    }

    validateColors(colors) {
        if (!Array.isArray(colors)) return false;
        return colors.every(color => typeof color === 'string' && color.trim().length > 0);
    }

    safeJsonParse(str, fallback = null) {
        if (!str) return fallback;
        if (typeof str === 'object') return str;
        try {
            return JSON.parse(str);
        } catch (error) {
            console.warn('JSON parse error:', error.message, 'Input:', str);
            return fallback;
        }
    }

    async cleanupFiles(filenames, uploadDir = this.uploadDir) {
        await Promise.all(
            filenames.map(async (filename) => {
                const filePath = path.join(uploadDir, filename);
                try {
                    await fs.access(filePath);
                    await fs.unlink(filePath);
                } catch (err) {
                    console.warn(`Cleanup failed for ${filename}:`, err.message);
                }
            })
        );
    }
}

module.exports = new ProductService();
