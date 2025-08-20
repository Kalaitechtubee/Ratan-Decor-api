const Enquiry = require('./models');

const enquiryController = {
  // Create new enquiry
  async createEnquiry(req, res) {
    try {
      const { userId, productId, userType, source, notes, videoCallDateTime } = req.body;
      
      const enquiry = await Enquiry.create({
        userId,
        productId,
        userType,
        source,
        notes,
        videoCallDateTime,
        status: 'New'
      });

      res.status(201).json({
        success: true,
        message: 'Enquiry created successfully',
        data: enquiry
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating enquiry',
        error: error.message
      });
    }
  },

  // Get all enquiries with filters
  async getAllEnquiries(req, res) {
    try {
      const { source, userType, status, page = 1, limit = 10 } = req.query;
      
      const whereClause = {};
      if (source) whereClause.source = source;
      if (userType) whereClause.userType = userType;
      if (status) whereClause.status = status;

      const { User } = require('../models');
      const { Product } = require('../models');
      
      const enquiries = await Enquiry.findAndCountAll({
        where: whereClause,
        include: [
          { model: User, as: 'user' },
          { model: Product, as: 'product' }
        ],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: enquiries.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(enquiries.count / limit),
          totalItems: enquiries.count
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching enquiries',
        error: error.message
      });
    }
  },

  // Update enquiry status
  async updateEnquiryStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const enquiry = await Enquiry.findByPk(id);
      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: 'Enquiry not found'
        });
      }

      await enquiry.update({ status, notes });
      
      res.json({
        success: true,
        message: 'Enquiry status updated',
        data: enquiry
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating enquiry',
        error: error.message
      });
    }
  }
};

module.exports = enquiryController;
