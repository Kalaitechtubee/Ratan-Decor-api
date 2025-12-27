// controllers/videoCallEnquiryController.js
const { Op } = require("sequelize");
const { VideoCallEnquiry, VideoCallInternalNote, User, Product } = require("../models");
const { formatTimeForStorage, formatTimeForDisplay, isValidTime } = require("../utils/timeUtils");

const videoCallEnquiryController = {
  async create(req, res) {
    try {
      console.log("Starting create method");
      console.log("Request body:", req.body);
      console.log("User from request:", req.user || "Unauthenticated user");

      const { userId, productId, name, email, phoneNo, videoCallDate, videoCallTime, source, notes } = req.body;

      // Validate required fields
      if (!name || !email || !phoneNo || !videoCallDate || !videoCallTime) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: name, email, phoneNo, videoCallDate, videoCallTime",
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: "Invalid email format" });
      }

      // Validate phone number format (example: allow digits, +, and spaces)
      const phoneRegex = /^\+?[\d\s-]{10,15}$/;
      if (!phoneRegex.test(phoneNo)) {
        return res.status(400).json({ success: false, message: "Invalid phone number format" });
      }

      // If authenticated, use req.user.id; otherwise, allow guest (userId null)
      const enquiryUserId = req.user?.id || userId || null;

      // Validate time format
      if (!isValidTime(videoCallTime)) {
        return res.status(400).json({ success: false, message: "Invalid time format. Please use HH:mm or H:mm AM/PM format." });
      }

      // Optional: Check if productId exists (if provided)
      if (productId) {
        const product = await Product.findByPk(productId);
        if (!product) {
          return res.status(400).json({ success: false, message: "Invalid product ID" });
        }
      }

      console.log("About to create VideoCallEnquiry");
      // Create the VideoCallEnquiry
      const enquiry = await VideoCallEnquiry.create({
        userId: enquiryUserId,
        productId: productId || null,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phoneNo: phoneNo.replace(/[^0-9+]/g, ""), // Clean phone number
        videoCallDate,
        videoCallTime: formatTimeForStorage(videoCallTime), // Convert to 24-hour format for storage
        source: source || "Guest",
        notes: notes || null,
      });

      return res.status(201).json({
        success: true,
        message: "Video call enquiry created successfully",
        data: {
          id: enquiry.id,
          name: enquiry.name,
          email: enquiry.email,
          phoneNo: enquiry.phoneNo,
          videoCallDate: enquiry.videoCallDate,
          videoCallTime: formatTimeForDisplay(enquiry.videoCallTime), // Convert to AM/PM format for display
        },
      });
    } catch (error) {
      console.error("Create enquiry error:", error);
      return res.status(500).json({ success: false, message: "Failed to create enquiry", error: error.message });
    }
  },
  // Get All with internal notes and enhanced filtering
  async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        search,
        source,
        startDate,
        endDate,
        userType,
        state,
        city,
        role,
        pincode,
        includeNotes = false
      } = req.query;

      const where = {};

      if (status) where.status = status;
      if (source) where.source = source;

      // Date Range Filter
      if (startDate && endDate) {
        where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      } else if (startDate) {
        where.createdAt = { [Op.gte]: new Date(startDate) };
      } else if (endDate) {
        where.createdAt = { [Op.lte]: new Date(endDate) };
      }

      const includes = [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role"],
          where: {},
          required: false // Default to false, unless filtering by user attributes
        },
        { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
      ];

      // Filter by User Attributes (State, City, Pincode, Role, UserType)
      if (state || city || role || pincode || userType) {
        includes[0].required = true;
        if (state) includes[0].where.state = { [Op.like]: `%${state}%` };
        if (city) includes[0].where.city = { [Op.like]: `%${city}%` };
        if (role) includes[0].where.role = role;
        if (pincode) includes[0].where.pincode = pincode;
        if (userType) includes[0].where.userTypeId = userType;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phoneNo: { [Op.like]: `%${search}%` } },
        ];
      }

      if (includeNotes === 'true') {
        includes.push({
          model: VideoCallInternalNote,
          as: "internalNotes",
          include: [
            { model: User, as: "staffUser", attributes: ["id", "name", "email"] }
          ],
          order: [["createdAt", "DESC"]]
        });
      }

      const result = await VideoCallEnquiry.findAndCountAll({
        where,
        include: includes,
        limit: parseInt(limit),
        offset: (page - 1) * limit,
        order: [["createdAt", "DESC"]],
      });

      // Calculate status breakdown for summary cards - must include User join if filtering by user attributes
      const statsIncludes = [];
      if (state || city || role || pincode || userType) {
        statsIncludes.push({
          model: User,
          as: "user",
          attributes: [],
          where: includes[0].where,
          required: true
        });
      }

      const statusStats = await VideoCallEnquiry.findAll({
        where,
        include: statsIncludes,
        attributes: [
          'status',
          [VideoCallEnquiry.sequelize.fn('COUNT', VideoCallEnquiry.sequelize.col('VideoCallEnquiry.id')), 'count'],
        ],
        group: ['status'],
        raw: true
      });

      const summary = {
        totalItems: await VideoCallEnquiry.count({
          where: Object.fromEntries(Object.entries(where).filter(([k]) => k !== 'status')),
          include: statsIncludes
        }),
        statusBreakdown: {}
      };

      statusStats.forEach(stat => {
        summary.statusBreakdown[stat.status] = parseInt(stat.count);
      });

      // Format time for display in AM/PM format
      const formattedData = result.rows.map(enquiry => ({
        ...enquiry.toJSON(),
        videoCallTime: formatTimeForDisplay(enquiry.videoCallTime)
      }));

      res.json({
        success: true,
        data: formattedData,
        summary,
        pagination: {
          page: parseInt(page),
          totalPages: Math.ceil(result.count / limit),
          totalItems: result.count,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Get video call enquiries error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get By ID with internal notes (supports unauthenticated access with email query param)
  async getById(req, res) {
    try {
      const { includeNotes = false } = req.query;

      // Basic includes (always fetch these for auth check)
      const basicIncludes = [
        { model: User, as: "user", attributes: ["id", "name", "email", "role"] },
        { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
      ];

      // Fetch enquiry with basic includes
      let enquiry = await VideoCallEnquiry.findByPk(req.params.id, {
        include: basicIncludes,
      });

      if (!enquiry) {
        return res.status(404).json({ success: false, message: "Enquiry not found" });
      }

      // Authorization check
      let authorized = false;
      if (req.user) {
        // Check if staff (adjust roles based on your app's roles; includes common ones from code context)
        const staffRoles = ['admin', 'manager', 'superadmin', 'sales'];
        const isStaff = staffRoles.some(role => req.user.role && req.user.role.toLowerCase().includes(role));
        const isOwner = enquiry.userId && enquiry.userId === req.user.id;
        authorized = isStaff || isOwner;
      } else {
        // Unauthenticated: require matching email in query param
        const providedEmail = req.query.email;
        authorized = providedEmail && enquiry.email.toLowerCase() === providedEmail.trim().toLowerCase();
      }

      if (!authorized) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized access to this enquiry. Authenticated users must be owners or staff; unauthenticated users must provide a matching email query parameter."
        });
      }

      // Handle internal notes only if authenticated and requested
      if (includeNotes === 'true') {
        if (!req.user) {
          return res.status(403).json({
            success: false,
            message: "Authentication required to view internal notes."
          });
        }
        const notes = await VideoCallInternalNote.findAll({
          where: { enquiryId: req.params.id },
          include: [
            { model: User, as: "staffUser", attributes: ["id", "name", "email"] }
          ],
          order: [["createdAt", "DESC"]]
        });
        // Attach notes to enquiry
        enquiry.setDataValue('internalNotes', notes);
      }

      // Format time for display
      const formattedEnquiry = {
        ...enquiry.toJSON(),
        videoCallTime: formatTimeForDisplay(enquiry.videoCallTime)
      };

      res.json({ success: true, data: formattedEnquiry });
    } catch (error) {
      console.error("Get enquiry by ID error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update
  async update(req, res) {
    try {
      const enquiry = await VideoCallEnquiry.findByPk(req.params.id);
      if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

      // Handle time conversion if videoCallTime is being updated
      const updateData = { ...req.body };
      if (updateData.videoCallTime) {
        if (!isValidTime(updateData.videoCallTime)) {
          return res.status(400).json({ success: false, message: "Invalid time format. Please use HH:mm or H:mm AM/PM format." });
        }
        updateData.videoCallTime = formatTimeForStorage(updateData.videoCallTime);
      }

      await enquiry.update(updateData);

      const updated = await VideoCallEnquiry.findByPk(req.params.id, {
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email", "role"] },
          { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
        ],
      });

      // Format time for display
      const formattedUpdated = {
        ...updated.toJSON(),
        videoCallTime: formatTimeForDisplay(updated.videoCallTime)
      };

      res.json({ success: true, message: "Enquiry updated", data: formattedUpdated });
    } catch (error) {
      console.error("Update enquiry error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get My Enquiries
  async getMyEnquiries(req, res) {
    try {
      const enquiries = await VideoCallEnquiry.findAll({
        where: { userId: req.user.id },
        include: [
          { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
        ],
        order: [["createdAt", "DESC"]],
      });

      // Format time for display
      const formattedEnquiries = enquiries.map(enquiry => ({
        ...enquiry.toJSON(),
        videoCallTime: formatTimeForDisplay(enquiry.videoCallTime)
      }));

      res.json({ success: true, data: formattedEnquiries });
    } catch (error) {
      console.error("Get my enquiries error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete
  async delete(req, res) {
    try {
      const enquiry = await VideoCallEnquiry.findByPk(req.params.id);
      if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

      await enquiry.destroy();
      res.json({ success: true, message: "Enquiry deleted" });
    } catch (error) {
      console.error("Delete enquiry error:", error);
      res.status(500).json({ success: false, message: error.message });
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
      const enquiry = await VideoCallEnquiry.findByPk(parseInt(enquiryId));
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

      const internalNote = await VideoCallInternalNote.create(noteData);

      // Fetch the created note with associations
      const enrichedNote = await VideoCallInternalNote.findByPk(internalNote.id, {
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

      const notes = await VideoCallInternalNote.findAndCountAll({
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

      const internalNote = await VideoCallInternalNote.findByPk(parseInt(noteId));
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

      const updated = await VideoCallInternalNote.findByPk(parseInt(noteId), {
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

      const internalNote = await VideoCallInternalNote.findByPk(parseInt(noteId));
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

  // GET FOLLOW-UP DASHBOARD
  async getFollowUpDashboard(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { days = 7 } = req.query;

      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + parseInt(days));
      const futureDate = upcomingDate.toISOString().split('T')[0];

      const followUps = await VideoCallInternalNote.findAll({
        where: {
          followUpDate: {
            [Op.between]: [today, futureDate]
          }
        },
        include: [
          {
            model: VideoCallEnquiry,
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

      // Format time for display in followUps
      const formattedFollowUps = followUps.map(note => ({
        ...note.toJSON(),
        enquiry: {
          ...note.enquiry.toJSON(),
          videoCallTime: formatTimeForDisplay(note.enquiry.videoCallTime)
        }
      }));

      const overdue = await VideoCallInternalNote.findAll({
        where: {
          followUpDate: {
            [Op.lt]: today
          }
        },
        include: [
          {
            model: VideoCallEnquiry,
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

      // Format time for display in overdue
      const formattedOverdue = overdue.map(note => ({
        ...note.toJSON(),
        enquiry: {
          ...note.enquiry.toJSON(),
          videoCallTime: formatTimeForDisplay(note.enquiry.videoCallTime)
        }
      }));

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

module.exports = videoCallEnquiryController;