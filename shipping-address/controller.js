const { ShippingAddress, User } = require('../models');

// Create shipping address
const createShippingAddress = async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      isDefault,
      addressType
    } = req.body;

    const userId = req.user.id;

    // If this is set as default, unset other default addresses
    if (isDefault) {
      await ShippingAddress.update(
        { isDefault: false },
        { where: { userId, isDefault: true } }
      );
    }

    const shippingAddress = await ShippingAddress.create({
      userId,
      name,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      isDefault: isDefault || false,
      addressType: addressType || 'Home'
    });

    res.status(201).json({
      message: 'Shipping address created successfully',
      shippingAddress
    });
  } catch (error) {
    console.error('Create shipping address error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Get all shipping addresses for user
const getShippingAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    const shippingAddresses = await ShippingAddress.findAll({
      where: { userId },
      order: [
        ['isDefault', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    res.json({
      shippingAddresses,
      count: shippingAddresses.length
    });
  } catch (error) {
    console.error('Get shipping addresses error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Get single shipping address by ID
const getShippingAddressById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const shippingAddress = await ShippingAddress.findOne({
      where: { id, userId }
    });

    if (!shippingAddress) {
      return res.status(404).json({ message: 'Shipping address not found' });
    }

    res.json({ shippingAddress });
  } catch (error) {
    console.error('Get shipping address error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Update shipping address
const updateShippingAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      name,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      isDefault,
      addressType
    } = req.body;

    const shippingAddress = await ShippingAddress.findOne({
      where: { id, userId }
    });

    if (!shippingAddress) {
      return res.status(404).json({ message: 'Shipping address not found' });
    }

    // If this is set as default, unset other default addresses
    if (isDefault) {
      await ShippingAddress.update(
        { isDefault: false },
        { where: { userId, isDefault: true, id: { [require('sequelize').Op.ne]: id } } }
      );
    }

    await shippingAddress.update({
      name,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      isDefault,
      addressType
    });

    res.json({
      message: 'Shipping address updated successfully',
      shippingAddress
    });
  } catch (error) {
    console.error('Update shipping address error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Delete shipping address
const deleteShippingAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const shippingAddress = await ShippingAddress.findOne({
      where: { id, userId }
    });

    if (!shippingAddress) {
      return res.status(404).json({ message: 'Shipping address not found' });
    }

    await shippingAddress.destroy();

    res.json({ message: 'Shipping address deleted successfully' });
  } catch (error) {
    console.error('Delete shipping address error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Set default shipping address
const setDefaultShippingAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const shippingAddress = await ShippingAddress.findOne({
      where: { id, userId }
    });

    if (!shippingAddress) {
      return res.status(404).json({ message: 'Shipping address not found' });
    }

    // Unset all other default addresses
    await ShippingAddress.update(
      { isDefault: false },
      { where: { userId, isDefault: true } }
    );

    // Set this address as default
    await shippingAddress.update({ isDefault: true });

    res.json({
      message: 'Default shipping address updated successfully',
      shippingAddress
    });
  } catch (error) {
    console.error('Set default shipping address error:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createShippingAddress,
  getShippingAddresses,
  getShippingAddressById,
  updateShippingAddress,
  deleteShippingAddress,
  setDefaultShippingAddress
};
