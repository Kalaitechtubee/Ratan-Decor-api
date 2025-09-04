// address/controller.js
const { Address } = require('../models');

const createAddress = async (req, res) => {
  try {
    const { street, city, state, country, postalCode, type } = req.body;
    const address = await Address.create({
      userId: req.user.id,
      street, city, state, country, postalCode, type
    });
    res.status(201).json(address);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const getAddressById = async (req, res) => {
  try {
    const { id } = req.params;
    const address = await Address.findOne({ where: { id, userId: req.user.id } });
    if (!address) return res.status(404).json({ message: 'Address not found' });
    res.json(address);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAddresses = async (req, res) => {
  try {
    const addresses = await Address.findAll({ where: { userId: req.user.id } });
    res.json(addresses);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { street, city, state, country, postalCode, type } = req.body;
    const address = await Address.findOne({ where: { id, userId: req.user.id } });
    if (!address) return res.status(404).json({ message: 'Address not found' });
    await address.update({ street, city, state, country, postalCode, type });
    res.json(address);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const address = await Address.findOne({ where: { id, userId: req.user.id } });
    if (!address) return res.status(404).json({ message: 'Address not found' });
    await address.destroy();
    res.json({ message: 'Address deleted' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { 
  createAddress, 
  getAddresses, 
  getAddressById,   // 👈 add this
  updateAddress, 
  deleteAddress 
};
