const ProductUsageType = require("./models");
const slugify = require("slugify");

// Create new product usage type
exports.createProductUsageType = async (req, res) => {
  try {
    const { typeName, description, imageUrl } = req.body;
    const slug = slugify(typeName, { lower: true });

    const exists = await ProductUsageType.findOne({ where: { slug } });
    if (exists) return res.status(400).json({ message: "Product usage type already exists." });

    const usageType = await ProductUsageType.create({ 
      typeName, 
      slug, 
      description,
      imageUrl
    });
    res.status(201).json(usageType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all product usage types
exports.getAllProductUsageTypes = async (req, res) => {
  try {
    const types = await ProductUsageType.findAll({ 
      where: { isActive: true },
      order: [["typeName", "ASC"]] 
    });
    res.status(200).json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single product usage type
exports.getProductUsageTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const usageType = await ProductUsageType.findByPk(id);
    
    if (!usageType) {
      return res.status(404).json({ message: "Product usage type not found" });
    }

    res.status(200).json(usageType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update product usage type
exports.updateProductUsageType = async (req, res) => {
  try {
    const { id } = req.params;
    const { typeName, description, imageUrl } = req.body;

    const usageType = await ProductUsageType.findByPk(id);
    if (!usageType) return res.status(404).json({ message: "Product usage type not found" });

    const slug = slugify(typeName, { lower: true });

    await usageType.update({
      typeName,
      slug,
      description,
      imageUrl,
    });

    res.status(200).json(usageType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle active/inactive
exports.toggleProductUsageTypeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const usageType = await ProductUsageType.findByPk(id);
    if (!usageType) return res.status(404).json({ message: "Product usage type not found" });

    usageType.isActive = !usageType.isActive;
    await usageType.save();

    res.status(200).json({ message: "Status updated", usageType });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};