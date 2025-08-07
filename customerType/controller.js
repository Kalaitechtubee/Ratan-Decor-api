// backend/customerType/controller.js
const CustomerType = require("./models");
const slugify = require("slugify");

// Create new customer type
exports.createCustomerType = async (req, res) => {
  try {
    const { typeName, discountPercentage = 0 } = req.body;
    const slug = slugify(typeName, { lower: true });

    const exists = await CustomerType.findOne({ where: { slug } });
    if (exists) return res.status(400).json({ message: "Customer type already exists." });

    const customerType = await CustomerType.create({ 
      typeName, 
      slug, 
      discountPercentage 
    });
    res.status(201).json(customerType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all customer types
exports.getAllCustomerTypes = async (req, res) => {
  try {
    const types = await CustomerType.findAll({ 
      where: { isActive: true },
      order: [["id", "ASC"]] 
    });
    res.status(200).json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle active/inactive
exports.toggleCustomerTypeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const customerType = await CustomerType.findByPk(id);
    if (!customerType) return res.status(404).json({ message: "Customer type not found" });

    customerType.isActive = !customerType.isActive;
    await customerType.save();

    res.status(200).json({ message: "Status updated", customerType });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};