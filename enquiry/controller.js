const { Enquiry, User, Product, EnquiryInternalNote, UserType, sequelize } = require("../models");
const { Op } = require("sequelize");
const jwt = require('jsonwebtoken');
const { formatTimeForStorage, formatTimeForDisplay, isValidTime } = require("../utils/timeUtils");

const getReqUserRole = (req) => {
  if (req.user && req.user.role) {
    return req.user.role;
  }
  const auth = req.header('Authorization');
  if (!auth) return 'General';
  const token = auth.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    return decoded.role || 'General';
  } catch {
    return 'General';
  }
};

const computePrice = (product, role) =>
  role === 'Dealer'
    ? product.dealerPrice
    : role === 'Architect'
      ? product.architectPrice
      : product.generalPrice;

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
        role,
        pincode,
        productDesignNumber,
      } = req.body;


      let finalUserId = userId;
      if (!finalUserId && req.user) {
        finalUserId = req.user.id;
      }


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

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }


      const cleanPhone = phoneNo.replace(/[^\d]/g, "");
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be between 10-15 digits",
        });
      }


      const parsedProductId = productId ? parseInt(productId, 10) : null;
      if (productId && isNaN(parsedProductId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format",
        });
      }

      const validRoles = ["customer", "Architect", "Dealer", "Admin", "Manager", "Sales", "Support", "General", "SuperAdmin"];
      if (role) {
        const normalizedRole = validRoles.find(r => r.toLowerCase() === role.toLowerCase());
        if (!normalizedRole) {
          return res.status(400).json({
            success: false,
            message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
          });
        }
      }

      const validSources = ["Email", "WhatsApp", "Phone", "VideoCall"];
      if (source && !validSources.includes(source)) {
        return res.status(400).json({
          success: false,
          message: `Invalid source. Must be one of: ${validSources.join(", ")}`,
        });
      }


      const cleanPincode = pincode ? pincode.replace(/[^\d]/g, "") : null;
      if (pincode && (!cleanPincode || cleanPincode.length !== 6)) {
        return res.status(400).json({
          success: false,
          message: "Pincode must be a 6-digit number",
        });
      }

      // Validate videoCallTime if provided
      let formattedVideoCallTime = null;
      if (videoCallTime) {
        if (!isValidTime(videoCallTime)) {
          return res.status(400).json({
            success: false,
            message: "Invalid video call time format. Please use HH:MM AM/PM or HH:MM format",
          });
        }
        formattedVideoCallTime = formatTimeForStorage(videoCallTime);
      }

      // Resolve userType: accept numeric ID or name
      let finalUserTypeId = null;
      if (userType) {
        if (!isNaN(parseInt(userType, 10))) {
          finalUserTypeId = parseInt(userType, 10);
        } else {
          const userTypeRecord = await UserType.findOne({
            where: { name: userType.toString().trim() },
          });
          if (!userTypeRecord) {
            // Optional: You can choose to error out or fall back to a default.
            // For now, let's try to find a default "General" type if specific type fails, or error.
            // But let's stick to error if specific type provided is invalid, 
            // OR if it's "General" and not found, maybe just null?
            // Let's return error for consistency with updateEnquiry.
            return res.status(400).json({
              success: false,
              message: `Invalid userType: ${userType}`,
            });
          }
          finalUserTypeId = userTypeRecord.id;
        }
      }

      const enquiry = await Enquiry.create({
        userId: finalUserId,
        productId: parsedProductId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        companyName: companyName?.trim() || null,
        state: state.trim(),
        city: city.trim(),
        userType: finalUserTypeId,
        source: source || "Email",
        notes: notes?.trim() || null,
        videoCallDate: videoCallDate || null,
        videoCallTime: formattedVideoCallTime || null,
        status: "New",
        role: role || req.user?.role || "customer",
        pincode: cleanPincode,
        productDesignNumber: productDesignNumber?.trim() || null,
      });

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

            attributes: { exclude: [] },
            required: false,
          },
          {
            model: UserType,
            as: "userTypeData",
            attributes: ["id", "name"],
            required: false,
          },
        ],
      });

      // Extract user data separately
      const userData = enrichedEnquiry?.user || null;

      // Prepare enquiry data without nested user
      const enquiryData = { ...enrichedEnquiry.toJSON() };
      delete enquiryData.user;

      if (enquiryData && enquiryData.userTypeData) {
        enquiryData.userType = enquiryData.userTypeData.name;
      }

      if (enquiryData && enquiryData.product) {
        const userRole = getReqUserRole(req);
        const computedPrice = computePrice(enquiryData.product, userRole);

        delete enquiryData.product.generalPrice;
        delete enquiryData.product.architectPrice;
        delete enquiryData.product.dealerPrice;

        enquiryData.product.price = computedPrice;
      }

      res.status(201).json({
        success: true,
        message: "Enquiry created successfully",
        data: enquiryData,
        user: userData,
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
        pincode,
        priority,
        startDate,
        endDate,
        userTypeName,
        includeNotes = false
      } = req.query;

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
          { phone: { [Op.like]: `%${search}%` } },
          { companyName: { [Op.like]: `%${search}%` } },
          { pincode: { [Op.like]: `%${search}%` } },
          { productDesignNumber: { [Op.like]: `%${search}%` } },
        ];
      }
      if (status) where.status = status;

      // Source mapping for frontend values
      if (source) {
        const sourceMap = {
          email: "email",
          phone: "phone",
          whatsapp: "phone",
          videocall: "phone",
          video: "phone",
          website: "website",
          chat: "chat",
          social: "social-media",
          "social-media": "social-media",
          other: "other",
        };
        const normalizedSource = source.toString().toLowerCase();
        where.source = sourceMap[normalizedSource] || normalizedSource;
      }

      if (userType) where.userType = userType;

      // Support for filtering by UserType name
      if (userTypeName) {
        const ut = await UserType.findOne({ where: { name: userTypeName } });
        if (ut) where.userType = ut.id;
      }

      if (state) where.state = state;
      if (city) where.city = city;
      if (role) where.role = role;
      if (pincode) where.pincode = pincode;
      if (priority) where.priority = priority;

      // Date range filtering
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt[Op.lte] = end;
        }
      }

      const include = [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role", "state", "city", "pincode", "address", "country", "mobile"],
          required: false,
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "generalPrice", "architectPrice", "dealerPrice"],
          required: false,
        },
        {
          model: UserType,
          as: "userTypeData",
          attributes: ["id", "name"],
          required: false,
        },
      ];


      if (includeNotes === 'true') {
        include.push({
          model: EnquiryInternalNote,
          as: "internalNotes",
          include: [
            { model: User, as: "staffUser", attributes: ["id", "name", "email"] }
          ],
          order: [["createdAt", "DESC"]]
        });
      }

      const enquiries = await Enquiry.findAndCountAll({
        where,
        include,
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        order: [["createdAt", "DESC"]],
      });

      enquiries.rows.forEach(enquiry => {
        if (enquiry && enquiry.userTypeData) {
          enquiry.userType = enquiry.userTypeData.name;
        }
        if (enquiry && enquiry.product) {
          const userRole = getReqUserRole(req);
          const computedPrice = computePrice(enquiry.product, userRole);
          enquiry.product.price = computedPrice;
          delete enquiry.product.generalPrice;
          delete enquiry.product.architectPrice;
          delete enquiry.product.dealerPrice;
        }
      });

      // Calculate status breakdown for summary cards - must include User join if filtering by user attributes
      const statsIncludes = [];
      if (state || city || role || pincode || userType || userTypeName) {
        statsIncludes.push({
          model: User,
          as: "user",
          attributes: [],
          where: include[0].where || {},
          required: true
        });
      }

      const statusStats = await Enquiry.findAll({
        where,
        include: statsIncludes,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('Enquiry.id')), 'count'],
        ],
        group: ['status'],
        raw: true
      });

      const summary = {
        totalEnquiries: await Enquiry.count({
          where: Object.fromEntries(Object.entries(where).filter(([k]) => k !== 'status')),
          include: statsIncludes
        }),
        statusBreakdown: {}
      };

      statusStats.forEach(stat => {
        summary.statusBreakdown[stat.status] = parseInt(stat.count);
      });

      res.json({
        success: true,
        message: "Enquiries retrieved successfully",
        data: enquiries.rows,
        summary,
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
      const { includeNotes = false } = req.query;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid enquiry ID",
        });
      }

      const include = [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role", "state", "city", "pincode", "address", "country", "mobile"],
          required: false
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "generalPrice", "architectPrice", "dealerPrice"],
          required: false
        },
        {
          model: UserType,
          as: "userTypeData",
          attributes: ["id", "name"],
          required: false,
        },
      ];

      if (includeNotes === 'true') {
        include.push({
          model: EnquiryInternalNote,
          as: "internalNotes",
          include: [
            { model: User, as: "staffUser", attributes: ["id", "name", "email"] }
          ],
          order: [["createdAt", "DESC"]]
        });
      }

      const enquiry = await Enquiry.findByPk(id, { include });

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found",
        });
      }

      // Replace userType ID with name from userTypeData
      if (enquiry && enquiry.userTypeData) {
        enquiry.userType = enquiry.userTypeData.name;
      }

      // Compute role-based price for product
      if (enquiry && enquiry.product) {
        const userRole = getReqUserRole(req);
        const computedPrice = computePrice(enquiry.product, userRole);
        enquiry.product.price = computedPrice;
        // Remove individual price fields to show only role-based price
        delete enquiry.product.generalPrice;
        delete enquiry.product.architectPrice;
        delete enquiry.product.dealerPrice;
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
        role,
        status,
        pincode, // New field
        productDesignNumber, // New field
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

      const validRoles = ["customer", "Architect", "Dealer", "Admin", "Manager", "Sales", "Support", "General", "SuperAdmin"];
      if (role) {
        const normalizedRole = validRoles.find(r => r.toLowerCase() === role.toLowerCase());
        if (!normalizedRole) {
          return res.status(400).json({
            success: false,
            message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
          });
        }
      }
      const validStatuses = ["New", "InProgress", "Confirmed", "Delivered", "Rejected"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }

      // Normalize source to match model enum (lowercase)
      const validSources = ["website", "phone", "email", "chat", "social-media", "other"];
      const sourceMap = {
        email: "email",
        phone: "phone",
        whatsapp: "phone",
        videocall: "phone",
        video: "phone",
        website: "website",
        chat: "chat",
        social: "social-media",
        "social-media": "social-media",
        other: "other",
      };
      const normalizedSource = source ? source.toString().toLowerCase() : null;
      const mappedSource = normalizedSource ? (sourceMap[normalizedSource] || normalizedSource) : null;
      if (mappedSource && !validSources.includes(mappedSource)) {
        return res.status(400).json({
          success: false,
          message: `Invalid source. Must be one of: ${validSources.join(", ")}`,
        });
      }

      // Validate pincode if provided
      const cleanPincode = pincode ? pincode.replace(/[^\d]/g, "") : null;
      if (pincode && (!cleanPincode || cleanPincode.length !== 6)) {
        return res.status(400).json({
          success: false,
          message: "Pincode must be a 6-digit number",
        });
      }

      // Resolve userType: accept numeric ID or name
      let finalUserTypeId = undefined;
      if (userType !== undefined) {
        if (userType === null || userType === '') {
          finalUserTypeId = null;
        } else if (!isNaN(parseInt(userType, 10))) {
          finalUserTypeId = parseInt(userType, 10);
        } else {
          const userTypeRecord = await UserType.findOne({
            where: { name: userType.toString().trim() },
          });
          if (!userTypeRecord) {
            return res.status(400).json({
              success: false,
              message: `Invalid userType: ${userType}`,
            });
          }
          finalUserTypeId = userTypeRecord.id;
        }
      }

      // Validate videoCallTime if provided
      let formattedVideoCallTime = undefined;
      if (videoCallTime !== undefined) {
        if (videoCallTime && !isValidTime(videoCallTime)) {
          return res.status(400).json({
            success: false,
            message: "Invalid video call time format. Please use HH:MM AM/PM or HH:MM format",
          });
        }
        formattedVideoCallTime = videoCallTime ? formatTimeForStorage(videoCallTime) : null;
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (email !== undefined) updateData.email = email.trim().toLowerCase();
      if (phoneNo !== undefined) updateData.phone = phoneNo.replace(/[^\d]/g, "");
      if (companyName !== undefined) updateData.companyName = companyName?.trim() || null;
      if (state !== undefined) updateData.state = state.trim();
      if (city !== undefined) updateData.city = city.trim();
      if (userType !== undefined) updateData.userType = finalUserTypeId;
      if (source !== undefined) updateData.source = mappedSource || "website";
      if (notes !== undefined) updateData.notes = notes?.trim() || null;
      if (videoCallDate !== undefined) updateData.videoCallDate = videoCallDate || null;
      if (formattedVideoCallTime !== undefined) updateData.videoCallTime = formattedVideoCallTime;
      if (productId !== undefined) updateData.productId = productId ? parseInt(productId, 10) : null;
      if (role !== undefined) updateData.role = role;
      if (status !== undefined) updateData.status = status;
      if (pincode !== undefined) updateData.pincode = cleanPincode; // New field
      if (productDesignNumber !== undefined) updateData.productDesignNumber = productDesignNumber?.trim() || null; // New field
      updateData.updatedAt = new Date();

      await enquiry.update(updateData);

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
          {
            model: UserType,
            as: "userTypeData",
            attributes: ["id", "name"],
            required: false,
          },
        ],
      });

      // Replace userType ID with name from userTypeData
      if (updatedEnquiry && updatedEnquiry.userTypeData) {
        updatedEnquiry.userType = updatedEnquiry.userTypeData.name;
      }

      // Compute role-based price for product
      if (updatedEnquiry && updatedEnquiry.product) {
        const userRole = getReqUserRole(req);
        const computedPrice = computePrice(updatedEnquiry.product, userRole);
        updatedEnquiry.product.price = computedPrice;
        // Remove individual price fields to show only role-based price
        delete updatedEnquiry.product.generalPrice;
        delete updatedEnquiry.product.architectPrice;
        delete updatedEnquiry.product.dealerPrice;
      }

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
      const { status, notes, role, pincode, videoCallTime } = req.body; // Added pincode and videoCallTime

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

      const validRoles = ["customer", "Architect", "Dealer", "Admin", "Manager", "Sales", "Support", "General", "SuperAdmin"];
      if (role) {
        const normalizedRole = validRoles.find(r => r.toLowerCase() === role.toLowerCase());
        if (!normalizedRole) {
          return res.status(400).json({
            success: false,
            message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
          });
        }
      }

      // Validate pincode if provided
      const cleanPincode = pincode ? pincode.replace(/[^\d]/g, "") : null;
      if (pincode && (!cleanPincode || cleanPincode.length !== 6)) {
        return res.status(400).json({
          success: false,
          message: "Pincode must be a 6-digit number",
        });
      }

      // Validate videoCallTime if provided
      let formattedVideoCallTime = undefined;
      if (videoCallTime !== undefined) {
        if (videoCallTime && !isValidTime(videoCallTime)) {
          return res.status(400).json({
            success: false,
            message: "Invalid video call time format. Please use HH:MM AM/PM or HH:MM format",
          });
        }
        formattedVideoCallTime = videoCallTime ? formatTimeForStorage(videoCallTime) : null;
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
      if (pincode !== undefined) updateData.pincode = cleanPincode; // New field
      if (formattedVideoCallTime !== undefined) updateData.videoCallTime = formattedVideoCallTime;
      updateData.updatedAt = new Date();

      await enquiry.update(updateData);

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
          {
            model: UserType,
            as: "userTypeData",
            attributes: ["id", "name"],
            required: false,
          },
        ],
      });

      // Replace userType ID with name from userTypeData
      if (updatedEnquiry && updatedEnquiry.userTypeData) {
        updatedEnquiry.userType = updatedEnquiry.userTypeData.name;
      }

      // Compute role-based price for product
      if (updatedEnquiry && updatedEnquiry.product) {
        const userRole = getReqUserRole(req);
        const computedPrice = computePrice(updatedEnquiry.product, userRole);
        updatedEnquiry.product.price = computedPrice;
        // Remove individual price fields to show only role-based price
        delete updatedEnquiry.product.generalPrice;
        delete updatedEnquiry.product.architectPrice;
        delete updatedEnquiry.product.dealerPrice;
      }

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

  // Add this to enquiryController object in enquiry/controller.js
  async deleteEnquiry(req, res) {
    try {
      const { id } = req.params;

      // Validate enquiry ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid enquiry ID",
        });
      }

      // Find the enquiry
      const enquiry = await Enquiry.findByPk(id);
      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found",
        });
      }

      // Check authorization (only Admin or Manager can delete)
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Only Admin or Manager can delete enquiries",
        });
      }

      // Delete the enquiry (cascading delete will handle related internal notes due to onDelete: 'CASCADE' in EnquiryInternalNote model)
      await enquiry.destroy();

      res.json({
        success: true,
        message: "Enquiry deleted successfully",
      });
    } catch (error) {
      console.error("Delete enquiry error:", error);
      res.status(500).json({
        success: false,
        message: `Error deleting enquiry: ${error.message}`,
      });
    }
  },
  // ADD INTERNAL NOTE (separate method)
  async addInternalNote(req, res) {
    try {
      const { id: enquiryId } = req.params;
      const { note, noteType, isImportant, followUpDate, userId, productId } = req.body;

      console.log("Adding internal note:");
      console.log("Enquiry ID:", enquiryId);
      console.log("Staff User ID:", req.user?.id);
      console.log("Note:", note);
      console.log("Request body:", req.body);

      // Validate required fields with detailed checks
      if (!note || typeof note !== 'string' || note.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Note content is required and cannot be empty"
        });
      }

      if (!enquiryId || isNaN(parseInt(enquiryId))) {
        return res.status(400).json({
          success: false,
          message: "Valid enquiry ID is required"
        });
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: "User authentication required"
        });
      }

      // Verify enquiry exists
      const enquiry = await Enquiry.findByPk(parseInt(enquiryId));
      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found"
        });
      }

      // Create internal note with explicit validation and type conversion
      const noteData = {
        enquiryId: parseInt(enquiryId),
        staffUserId: parseInt(req.user.id),
        note: note.trim(),
        noteType: noteType && ['Follow-up', 'Contact Attempt', 'Meeting Notes', 'Status Update', 'Other'].includes(noteType)
          ? noteType
          : 'Follow-up',
        isImportant: Boolean(isImportant),
        followUpDate: followUpDate || null,
        userId: userId ? parseInt(userId) : null,
        productId: productId ? parseInt(productId) : null
      };

      console.log("Creating note with validated data:", noteData);

      // Validate all required fields are present before creation
      if (!noteData.enquiryId || !noteData.staffUserId || !noteData.note) {
        console.error("Missing required fields:", {
          enquiryId: noteData.enquiryId,
          staffUserId: noteData.staffUserId,
          note: noteData.note
        });
        return res.status(400).json({
          success: false,
          message: "Missing required fields for internal note creation"
        });
      }

      const internalNote = await EnquiryInternalNote.create(noteData);

      // Fetch the created note with associations
      const enrichedNote = await EnquiryInternalNote.findByPk(internalNote.id, {
        include: [
          { model: User, as: "staffUser", attributes: ["id", "name", "email"] }
        ],
      });

      res.status(201).json({
        success: true,
        message: "Internal note added successfully",
        data: enrichedNote
      });
    } catch (error) {
      console.error("Add internal note error:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => `${err.path}: ${err.message}`);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: validationErrors
        });
      }

      res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET INTERNAL NOTES FOR ENQUIRY
  async getInternalNotes(req, res) {
    try {
      const { id: enquiryId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      if (!enquiryId || isNaN(parseInt(enquiryId))) {
        return res.status(400).json({ success: false, message: "Valid enquiry ID is required" });
      }

      const notes = await EnquiryInternalNote.findAndCountAll({
        where: { enquiryId: parseInt(enquiryId) },
        include: [
          { model: User, as: "staffUser", attributes: ["id", "name", "email"] }
        ],
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [["createdAt", "DESC"]]
      });

      res.json({
        success: true,
        data: notes.rows,
        pagination: {
          page: parseInt(page),
          totalPages: Math.ceil(notes.count / limit),
          totalItems: notes.count,
        },
      });
    } catch (error) {
      console.error("Get internal notes error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // UPDATE INTERNAL NOTE
  async updateInternalNote(req, res) {
    try {
      const { noteId } = req.params;
      const { note, noteType, isImportant, followUpDate } = req.body;

      if (!noteId || isNaN(parseInt(noteId))) {
        return res.status(400).json({ success: false, message: "Valid note ID is required" });
      }

      const internalNote = await EnquiryInternalNote.findByPk(parseInt(noteId));
      if (!internalNote) {
        return res.status(404).json({ success: false, message: "Internal note not found" });
      }

      // Only allow the creator or admin to update
      if (internalNote.staffUserId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Not authorized to update this note" });
      }

      // Update with explicit validation
      const updateData = {};
      if (note !== undefined && note !== null) {
        if (typeof note !== 'string' || note.trim().length === 0) {
          return res.status(400).json({ success: false, message: "Note cannot be empty" });
        }
        updateData.note = note.trim();
      }
      if (noteType !== undefined) {
        if (['Follow-up', 'Contact Attempt', 'Meeting Notes', 'Status Update', 'Other'].includes(noteType)) {
          updateData.noteType = noteType;
        }
      }
      if (isImportant !== undefined) updateData.isImportant = Boolean(isImportant);
      if (followUpDate !== undefined) updateData.followUpDate = followUpDate;

      await internalNote.update(updateData);

      const updated = await EnquiryInternalNote.findByPk(parseInt(noteId), {
        include: [
          { model: User, as: "staffUser", attributes: ["id", "name", "email"] }
        ],
      });

      res.json({ success: true, message: "Internal note updated", data: updated });
    } catch (error) {
      console.error("Update internal note error:", error);

      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => `${err.path}: ${err.message}`);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: validationErrors
        });
      }

      res.status(500).json({ success: false, message: error.message });
    }
  },

  // DELETE INTERNAL NOTE
  async deleteInternalNote(req, res) {
    try {
      const { noteId } = req.params;

      if (!noteId || isNaN(parseInt(noteId))) {
        return res.status(400).json({ success: false, message: "Valid note ID is required" });
      }

      const internalNote = await EnquiryInternalNote.findByPk(parseInt(noteId));
      if (!internalNote) {
        return res.status(404).json({ success: false, message: "Internal note not found" });
      }

      // Only allow the creator or admin to delete
      if (internalNote.staffUserId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Not authorized to delete this note" });
      }

      await internalNote.destroy();
      res.json({ success: true, message: "Internal note deleted" });
    } catch (error) {
      console.error("Delete internal note error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET FOLLOW-UP DASHBOARD FOR ENQUIRIES
  async getFollowUpDashboard(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { days = 7 } = req.query;

      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + parseInt(days));
      const futureDate = upcomingDate.toISOString().split('T')[0];

      const followUps = await EnquiryInternalNote.findAll({
        where: {
          followUpDate: {
            [Op.between]: [today, futureDate]
          }
        },
        include: [
          {
            model: Enquiry,
            as: "enquiry",
            include: [
              { model: User, as: "user", attributes: ["id", "name", "email"] },
              { model: Product, as: "product", attributes: ["id", "name"] }
            ]
          },
          { model: User, as: "staffUser", attributes: ["id", "name"] }
        ],
        order: [["followUpDate", "ASC"], ["isImportant", "DESC"]]
      });

      const overdue = await EnquiryInternalNote.findAll({
        where: {
          followUpDate: {
            [Op.lt]: today
          }
        },
        include: [
          {
            model: Enquiry,
            as: "enquiry",
            include: [
              { model: User, as: "user", attributes: ["id", "name", "email"] },
              { model: Product, as: "product", attributes: ["id", "name"] }
            ]
          },
          { model: User, as: "staffUser", attributes: ["id", "name"] }
        ],
        order: [["followUpDate", "ASC"], ["isImportant", "DESC"]]
      });

      res.json({
        success: true,
        data: {
          upcoming: followUps,
          overdue: overdue,
          summary: {
            upcomingCount: followUps.length,
            overdueCount: overdue.length,
            importantUpcoming: followUps.filter(note => note.isImportant).length,
            importantOverdue: overdue.filter(note => note.isImportant).length
          }
        }
      });
    } catch (error) {
      console.error("Get follow-up dashboard error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

};

module.exports = enquiryController;