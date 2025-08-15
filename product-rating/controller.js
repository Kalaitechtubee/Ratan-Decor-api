const { ProductRating, Product, User } = require('../models');

const productRatingController = {
  // Create/Update product rating
  async createRating(req, res) {
    try {
      const { userId, productId, rating, review } = req.body;
      
      // Check if user already rated this product
      let existingRating = await ProductRating.findOne({
        where: { userId, productId }
      });

      if (existingRating) {
        // Update existing rating
        await existingRating.update({ rating, review });
      } else {
        // Create new rating
        existingRating = await ProductRating.create({
          userId,
          productId,
          rating,
          review
        });
      }

      // Update product average rating
      await updateProductRating(productId);

      res.json({
        success: true,
        message: 'Rating submitted successfully',
        data: existingRating
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error submitting rating',
        error: error.message
      });
    }
  },

  // Get product ratings
  async getProductRatings(req, res) {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const ratings = await ProductRating.findAndCountAll({
        where: { productId, isActive: true },
        include: [
          { model: User, as: 'User', attributes: ['id', 'name'] }
        ],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: ratings.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(ratings.count / limit),
          totalItems: ratings.count
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching ratings',
        error: error.message
      });
    }
  }
};

// Helper function to update product average rating

