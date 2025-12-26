const { Category, Product, sequelize } = require('../models');
const { Op, Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');

class CategoryService {
    constructor() {
        this.uploadDir = path.join(__dirname, '..', 'uploads', 'categories');
    }

    generateImageUrl(filename, req, imageType = 'categories') {
        if (!filename || typeof filename !== 'string') return null;
        if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
        if (filename.startsWith('/uploads/')) return filename;
        const envBaseUrl = process.env.BASE_URL?.trim();
        const baseUrl = envBaseUrl || `${req.protocol}://${req.get('host')}`;
        return `${baseUrl}/uploads/${imageType}/${filename}`;
    }

    buildTree(categories, parentId = null, req = null) {
        return categories
            .filter(c => c.parentId === parentId)
            .map(c => {
                const childCategories = this.buildTree(categories, c.id, req);
                const isSubcategory = !!c.parentId;

                if (isSubcategory) {
                    return {
                        id: c.id,
                        name: c.name,
                        productCount: c.productCount || 0,
                        ...(childCategories.length > 0 && { subCategories: childCategories }),
                    };
                }

                return {
                    id: c.id,
                    name: c.name,
                    imageUrl: c.image ? this.generateImageUrl(c.image, req, 'categories') : null,
                    productCount: c.productCount || 0,
                    subCategories: childCategories,
                };
            });
    }

    async getDescendants(catId) {
        try {
            const results = await sequelize.query(`
        WITH RECURSIVE category_tree AS (
          SELECT id FROM \`categories\` WHERE id = :catId
          UNION ALL
          SELECT c.id FROM \`categories\` c
          INNER JOIN category_tree ct ON c.parentId = ct.id
        )
        SELECT id FROM category_tree WHERE id != :catId
      `, {
                replacements: { catId },
                type: Sequelize.QueryTypes.SELECT
            });

            if (!results || !Array.isArray(results)) throw new Error('CTE query returned invalid results');
            return results.map(r => r.id);
        } catch (error) {
            console.warn('CTE fetch failed, falling back to iterative:', error.message);
            const descendants = [];
            const queue = [catId];
            while (queue.length > 0) {
                const currentId = queue.shift();
                const children = await Category.findAll({ where: { parentId: currentId }, attributes: ['id'] });
                for (const child of children) {
                    descendants.push(child.id);
                    queue.push(child.id);
                }
            }
            return descendants;
        }
    }

    async cleanupFiles(filenames) {
        if (!filenames || filenames.length === 0) return;
        await Promise.all(
            filenames.map(async (filename) => {
                const filePath = path.join(this.uploadDir, filename);
                try {
                    await fs.access(filePath);
                    await fs.unlink(filePath);
                } catch (err) {
                    console.warn(`Cleanup failed for ${filename}:`, err.message);
                }
            })
        );
    }

    async validateCategoryName(name, parentId = null, excludeId = null, transaction = null) {
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            throw new Error(parentId ? 'Subcategory name must be at least 2 characters' : 'Category name must be at least 2 characters');
        }
        const trimmedName = name.trim();
        const where = {
            name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), Sequelize.fn('LOWER', trimmedName)),
            parentId: parentId || null // handle null explicitly
        };
        if (excludeId) where.id = { [Op.ne]: excludeId };

        const existing = await Category.findOne({ where, transaction });
        if (existing) {
            throw new Error(parentId ? 'Subcategory name already exists under this parent' : 'Category name already exists at the root level');
        }
        return trimmedName;
    }
}

module.exports = new CategoryService();
