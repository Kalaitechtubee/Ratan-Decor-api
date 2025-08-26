const { Enquiry, User, Product } = require("../models");
const { Op } = require("sequelize");

const enquiryController = {
  async createEnquiry(req, res) {
    try {
      const {
        userId,
        productId,
        name,
        email,
        phoneNo,
        companyName,
        state,
        city,
        userType,
        source,
        notes,
        videoCallDate,
        videoCallTime,
        productDesignNumber,
        role,
      } = req.body;

      // Get userId from token if not provided
      let finalUserId = userId;
      if (!finalUserId && req.user) {
        finalUserId = req.user.id;
      }

      // Validate required fields
      const requiredFields = ["name", "email", "phoneNo", "state", "city"];
      const missingFields = requiredFields.filter(
        (field) => !req.body[field]?.trim()
      );
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      // Validate phone number
      const cleanPhone = phoneNo.replace(/[^\d]/g, "");
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be between 10-15 digits",
        });
      }

      // Validate productId if provided
      const parsedProductId = productId ? parseInt(productId, 10) : null;
      if (productId && isNaN(parsedProductId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format",
        });
      }

      // Validate role
      const validRoles = ["Customer", "Architect", "Dealer", "Admin", "Manager", "Sales", "Support"];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
        });
      }

      // Validate source
      const validSources = ["Email", "WhatsApp", "Phone", "VideoCall"];
      if (source && !validSources.includes(source)) {
        return res.status(400).json({
          success: false,
          message: `Invalid source. Must be one of: ${validSources.join(", ")}`,
        });
      }

      const enquiry = await Enquiry.create({
        userId: finalUserId, // This can now be null safely
        productId: parsedProductId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phoneNo: cleanPhone,
        companyName: companyName?.trim() || null,
        state: state.trim(),
        city: city.trim(),
        userType: userType || "General",
        source: source || "Email",
        notes: notes?.trim() || null,
        videoCallDate: videoCallDate || null,
        videoCallTime: videoCallTime || null,
        productDesignNumber: productDesignNumber?.trim() || null,
        status: "New",
        role: role || "Customer",
      });

      // Include relations in response
      const enrichedEnquiry = await Enquiry.findByPk(enquiry.id, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "role"],
            required: false,
          },
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "generalPrice", "architectPrice", "dealerPrice"],
            required: false,
          },
        ],
      });

      res.status(201).json({
        success: true,
        message: "Enquiry created successfully",
        data: enrichedEnquiry,
      });
    } catch (error) {
      console.error("Create enquiry error:", error);
      if (error.name === "SequelizeValidationError") {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.errors.map((err) => ({
            field: err.path,
            message: err.message,
          })),
        });
      }
      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(400).json({
          success: false,
          message: "Duplicate entry found",
          error: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: `Error creating enquiry: ${error.message}`,
      });
    }
  },

  async getAllEnquiries(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        source,
        userType,
        state,
        city,
        role,
      } = req.query;

      // Validate page and limit
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ success: false, message: "Page must be a positive integer" });
      }
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({ success: false, message: "Limit must be between 1 and 100" });
      }

      const where = {};
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phoneNo: { [Op.like]: `%${search}%` } },
          { companyName: { [Op.like]: `%${search}%` } },
          { productDesignNumber: { [Op.like]: `%${search}%` } },
        ];
      }
      if (status) where.status = status;
      if (source) where.source = source;
      if (userType) where.userType = userType;
      if (state) where.state = state;
      if (city) where.city = city;
      if (role) where.role = role;

      const include = [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role"],
          required: false,
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "generalPrice", "architectPrice", "dealerPrice"],
          required: false,
        },
      ];

      const enquiries = await Enquiry.findAndCountAll({
        where,
        include,
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        order: [["createdAt", "DESC"]],
      });

      res.json({
        success: true,
        message: "Enquiries retrieved successfully",
        data: enquiries.rows,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(enquiries.count / limitNum),
          totalItems: enquiries.count,
          limit: limitNum,
        },
      });
    } catch (error) {
      console.error("Get all enquiries error:", error);
      res.status(500).json({
        success: false,
        message: `Error fetching enquiries: ${error.message}`,
      });
    }
  },

  async getEnquiryById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid enquiry ID",
        });
      }

      const enquiry = await Enquiry.findByPk(id, {
        include: [
          { 
            model: User, 
            as: "user", 
            attributes: ["id", "name", "email", "role"],
            required: false 
          },
          { 
            model: Product, 
            as: "product", 
            attributes: ["id", "name", "generalPrice", "architectPrice", "dealerPrice"],
            required: false 
          },
        ],
      });

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found",
        });
      }

      res.json({
        success: true,
        message: "Enquiry retrieved successfully",
        data: enquiry,
      });
    } catch (error) {
      console.error("Get enquiry by ID error:", error);
      res.status(500).json({
        success: false,
        message: `Error fetching enquiry by ID: ${error.message}`,
      });
    }
  },

  async updateEnquiry(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        email,
        phoneNo,
        companyName,
        state,
        city,
        userType,
        source,
        notes,
        videoCallDate,
        videoCallTime,
        productId,
        productDesignNumber,
        role,
        status,
      } = req.body;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid enquiry ID",
        });
      }

      const enquiry = await Enquiry.findByPk(id);
      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found",
        });
      }

      // Validate fields if provided
      if (name !== undefined && (!name || !name.trim())) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
      if (email !== undefined && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }
      if (phoneNo !== undefined && phoneNo) {
        const cleanPhone = phoneNo.replace(/[^\d]/g, "");
        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
          return res.status(400).json({
            success: false,
            message: "Phone number must be between 10-15 digits",
          });
        }
      }
      if (state !== undefined && (!state || !state.trim())) {
        return res.status(400).json({
          success: false,
          message: "State cannot be empty",
        });
      }
      if (city !== undefined && (!city || !city.trim())) {
        return res.status(400).json({
          success: false,
          message: "City cannot be empty",
        });
      }

      // Validate role and status if provided
      const validRoles = ["Customer", "Architect", "Dealer", "Admin", "Manager", "Sales", "Support"];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
        });
      }
      const validStatuses = ["New", "InProgress", "Confirmed", "Delivered", "Rejected"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }

      // Validate source if provided
      const validSources = ["Email", "WhatsApp", "Phone", "VideoCall"];
      if (source && !validSources.includes(source)) {
        return res.status(400).json({
          success: false,
          message: `Invalid source. Must be one of: ${validSources.join(", ")}`,
        });
      }

      // Build update data object
      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (email !== undefined) updateData.email = email.trim().toLowerCase();
      if (phoneNo !== undefined) updateData.phoneNo = phoneNo.replace(/[^\d]/g, "");
      if (companyName !== undefined) updateData.companyName = companyName?.trim() || null;
      if (state !== undefined) updateData.state = state.trim();
      if (city !== undefined) updateData.city = city.trim();
      if (userType !== undefined) updateData.userType = userType;
      if (source !== undefined) updateData.source = source;
      if (notes !== undefined) updateData.notes = notes?.trim() || null;
      if (videoCallDate !== undefined) updateData.videoCallDate = videoCallDate || null;
      if (videoCallTime !== undefined) updateData.videoCallTime = videoCallTime || null;
      if (productId !== undefined) updateData.productId = productId ? parseInt(productId, 10) : null;
      if (productDesignNumber !== undefined) updateData.productDesignNumber = productDesignNumber?.trim() || null;
      if (role !== undefined) updateData.role = role;
      if (status !== undefined) updateData.status = status;
      
      // Always update the updatedAt timestamp
      updateData.updatedAt = new Date();

      await enquiry.update(updateData);

      // Fetch updated enquiry with relations
      const updatedEnquiry = await Enquiry.findByPk(id, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "role"],
            required: false,
          },
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "generalPrice", "architectPrice", "dealerPrice"],
            required: false,
          },
        ],
      });

      res.json({
        success: true,
        message: "Enquiry updated successfully",
        data: updatedEnquiry,
      });
    } catch (error) {
      console.error("Update enquiry error:", error);
      if (error.name === "SequelizeValidationError") {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.errors.map((err) => ({
            field: err.path,
            message: err.message,
          })),
        });
      }
      res.status(500).json({
        success: false,
        message: `Error updating enquiry: ${error.message}`,
      });
    }
  },

  async updateEnquiryStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes, role } = req.body;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid enquiry ID",
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Status is required",
        });
      }

      const validStatuses = ["New", "InProgress", "Confirmed", "Delivered", "Rejected"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }

      const validRoles = ["Customer", "Architect", "Dealer", "Admin", "Manager", "Sales", "Support"];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
        });
      }

      const enquiry = await Enquiry.findByPk(id);
      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found",
        });
      }

      const updateData = { status };
      if (notes !== undefined) updateData.notes = notes?.trim() || null;
      if (role !== undefined) updateData.role = role;
      updateData.updatedAt = new Date();

      await enquiry.update(updateData);

      // Fetch updated enquiry with relations
      const updatedEnquiry = await Enquiry.findByPk(id, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "role"],
            required: false,
          },
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "generalPrice", "architectPrice", "dealerPrice"],
            required: false,
          },
        ],
      });

      res.json({
        success: true,
        message: "Enquiry status updated successfully",
        data: updatedEnquiry,
      });
    } catch (error) {
      console.error("Update enquiry status error:", error);
      res.status(500).json({
        success: false,
        message: `Error updating enquiry status: ${error.message}`,
      });
    }
  },
};

module.exports = enquiryController;