// address/controller.js
const { Address } = require('../models');

const createAddress = async (req, res) => {
  try {
    const { street, city, state, country, postalCode, type } = req.body;
    const address = await Address.create({
      userId: req.user.id,
      street, city, state, country, postalCode, type
    });
    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      address
    });
  } catch (error) {
    console.error('Create address error:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: error.errors.map(e => e.message).join(', ')
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create address'
    });
  }
};

const getAddressById = async (req, res) => {
  try {
    const { id } = req.params;
    const address = await Address.findOne({ where: { id, userId: req.user.id } });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }
    res.json({
      success: true,
      address
    });
  } catch (error) {
    console.error('Get address by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch address'
    });
  }
};

const getAddresses = async (req, res) => {
  try {
    const addresses = await Address.findAll({ 
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json({
      success: true,
      addresses,
      total: addresses.length
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch addresses'
    });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { street, city, state, country, postalCode, type } = req.body;
    const address = await Address.findOne({ where: { id, userId: req.user.id } });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }
    await address.update({ street, city, state, country, postalCode, type });
    res.json({
      success: true,
      message: 'Address updated successfully',
      address
    });
  } catch (error) {
    console.error('Update address error:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: error.errors.map(e => e.message).join(', ')
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update address'
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const address = await Address.findOne({ where: { id, userId: req.user.id } });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }
    await address.destroy();
    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete address'
    });
  }
};

module.exports = { 
  createAddress, 
  getAddresses, 
  getAddressById,  
  updateAddress, 
  deleteAddress 
};