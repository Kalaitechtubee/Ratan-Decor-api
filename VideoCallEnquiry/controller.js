// controllers/videoCallEnquiryController.js
const { Op } = require("sequelize");
const { VideoCallEnquiry, VideoCallInternalNote, User, Product } = require("../models");

const videoCallEnquiryController = {
  // Simplified CREATE method - no automatic internal note creation
// Simplified CREATE method - no automatic internal note creation
// Simplified CREATE method - no automatic internal note creation
// VideoCallEnquiry/controller.js
// Simplified CREATE method - no automatic internal note creation
async create(req, res) {
  try {
    console.log("Starting create method");
    console.log("Request body:", req.body);
    console.log("User from request:", req.user);

    const {
      userId,
      productId,
      name,
      email,
      phoneNo,
      videoCallDate,
      videoCallTime,
      source,
      notes,
    } = req.body;

    // Validate required fields
    if (!name || !email || !phoneNo || !videoCallDate || !videoCallTime) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, email, phoneNo, videoCallDate, videoCallTime",
      });
    }

    console.log("About to create VideoCallEnquiry");

    // Create the VideoCallEnquiry only
    const enquiry = await VideoCallEnquiry.create({
      userId: userId || null,
      productId: productId || null,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phoneNo: phoneNo.replace(/[^\d]/g, ""),
      videoCallDate,
      videoCallTime,
      notes: notes || null,
      source: source || "VideoCall",
      status: "New",
    });

    console.log("VideoCallEnquiry created with ID:", enquiry.id);

    // Fetch the created enquiry with associations
    const enriched = await VideoCallEnquiry.findByPk(enquiry.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email", "role"] },
        { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
        {
          model: VideoCallInternalNote,
          as: "internalNotes",
          include: [
            { model: User, as: "staffUser", attributes: ["id", "name", "email"] },
          ],
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    console.log("Enriched data fetched successfully");

    res.status(201).json({
      success: true,
      message: "Video Call Enquiry created successfully",
      data: enriched,
    });
  } catch (error) {
    console.error("Create video call enquiry error:", error);
    console.error("Error stack:", error.stack);

    if (error.name === "SequelizeValidationError") {
      const validationErrors = error.errors.map((err) => `${err.path}: ${err.message}`);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      });
    }

    res.status(500).json({ success: false, message: error.message });
  }
},
  // Get All with internal notes
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, status, search, includeNotes = false } = req.query;
      const where = {};

      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phoneNo: { [Op.like]: `%${search}%` } },
        ];
      }

      const includes = [
        { model: User, as: "user", attributes: ["id", "name", "email", "role"] },
        { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
      ];

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

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          totalPages: Math.ceil(result.count / limit),
          totalItems: result.count,
        },
      });
    } catch (error) {
      console.error("Get video call enquiries error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get By ID with internal notes
  async getById(req, res) {
    try {
      const { includeNotes = false } = req.query;
      
      const includes = [
        { model: User, as: "user", attributes: ["id", "name", "email", "role"] },
        { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
      ];

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

      const enquiry = await VideoCallEnquiry.findByPk(req.params.id, {
        include: includes,
      });

      if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

      res.json({ success: true, data: enquiry });
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

      await enquiry.update(req.body);

      const updated = await VideoCallEnquiry.findByPk(req.params.id, {
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email", "role"] },
          { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
        ],
      });

      res.json({ success: true, message: "Enquiry updated", data: updated });
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

      res.json({ success: true, data: enquiries });
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