const Seo = require("./model");

// Create SEO entry
exports.createSeo = async (req, res) => {
  try {
    const { pageName, title, description, keywords } = req.body;

    // Validate required fields
    if (!pageName || !title) {
      return res.status(400).json({ success: false, message: "pageName and title are required" });
    }

    const seo = await Seo.create({ pageName, title, description, keywords });
    res.status(201).json({ success: true, data: seo });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: `SEO entry for pageName '${req.body.pageName}' already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const { Op } = require("sequelize");

// Get all SEO entries (all page SEO details)
exports.getAllSeo = async (req, res) => {
  try {
    const { search } = req.query;
    let where = {};

    if (search) {
      where = {
        [Op.or]: [
          { pageName: { [Op.like]: `%${search}%` } },
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ]
      };
    }

    const seoList = await Seo.findAll({ where });
    res.json({ success: true, data: seoList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all page names
exports.getAllPageNames = async (req, res) => {
  try {
    const pageNames = await Seo.findAll({
      attributes: ['pageName'],
      raw: true
    });
    const names = pageNames.map(item => item.pageName);
    res.json({ success: true, data: names });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get SEO by ID
exports.getSeoById = async (req, res) => {
  try {
    const seo = await Seo.findByPk(req.params.id);
    if (!seo) {
      return res.status(404).json({ success: false, message: "SEO entry not found" });
    }
    res.json({ success: true, data: seo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get SEO by pageName
exports.getSeoByPageName = async (req, res) => {
  try {
    const seo = await Seo.findOne({ where: { pageName: req.params.pageName } });
    if (!seo) {
      return res.status(404).json({ success: false, message: `SEO entry for pageName '${req.params.pageName}' not found` });
    }
    res.json({ success: true, data: seo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update SEO entry
exports.updateSeo = async (req, res) => {
  try {
    const seo = await Seo.findByPk(req.params.id);
    if (!seo) {
      return res.status(404).json({ success: false, message: "SEO entry not found" });
    }

    const { pageName, title, description, keywords } = req.body;

    // Validate required fields
    if (!pageName || !title) {
      return res.status(400).json({ success: false, message: "pageName and title are required" });
    }

    await seo.update({ pageName, title, description, keywords });
    res.json({ success: true, data: seo });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: `SEO entry for pageName '${req.body.pageName}' already exists` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete SEO entry
exports.deleteSeo = async (req, res) => {
  try {
    const seo = await Seo.findByPk(req.params.id);
    if (!seo) {
      return res.status(404).json({ success: false, message: "SEO entry not found" });
    }

    await seo.destroy();
    res.json({ success: true, message: "SEO entry deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};