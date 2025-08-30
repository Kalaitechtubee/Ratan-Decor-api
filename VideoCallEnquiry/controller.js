// controllers/videoCallEnquiryController.js
const { Op } = require("sequelize");
const { VideoCallEnquiry, User, Product } = require("../models");

const videoCallEnquiryController = {
  // ✅ Create
  async create(req, res) {
    try {
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

      if (!name || !email || !phoneNo || !videoCallDate || !videoCallTime) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

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

      const enriched = await VideoCallEnquiry.findByPk(enquiry.id, {
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email", "role"] },
          { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
        ],
      });

      res.status(201).json({ success: true, message: "Video Call Enquiry created", data: enriched });
    } catch (error) {
      console.error("Create video call enquiry error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ Get All
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, status, search } = req.query;
      const where = {};

      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phoneNo: { [Op.like]: `%${search}%` } },
        ];
      }

      const result = await VideoCallEnquiry.findAndCountAll({
        where,
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email", "role"] },
          { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
        ],
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

  // ✅ Get By ID
  async getById(req, res) {
    try {
      const enquiry = await VideoCallEnquiry.findByPk(req.params.id, {
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email", "role"] },
          { model: Product, as: "product", attributes: ["id", "name", "generalPrice"] },
        ],
      });

      if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

      res.json({ success: true, data: enquiry });
    } catch (error) {
      console.error("Get enquiry by ID error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ Update
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
  // ✅ Get My Enquiries (only for logged-in user)
async getMyEnquiries(req, res) {
  try {
    const enquiries = await VideoCallEnquiry.findAll({
      where: { userId: req.user.id }, // restrict to logged-in user
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

  // ✅ Delete
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
};

module.exports = videoCallEnquiryController;
