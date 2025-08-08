const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models');
const { User } = db;

const register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      phone, company, address, gstNumber,
      mobile, country, state, city, pincode
    } = req.body;

    console.log('Registration attempt with role:', role);
    console.log('Request body:', req.body);

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email,
      password: hashedPassword,
      role: role || 'General',
      status: (role === 'Architect' || role === 'Dealer') ? 'Pending' : 'Approved',
      mobile: mobile || phone, // Handle both mobile and phone fields
      address,
      country,
      state,
      city,
      pincode,
      company,
      gstNumber
    };

    console.log('User data to create:', userData);

    const user = await User.create(userData);

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.status !== 'Approved') {
      return res.status(403).json({ message: 'Account not approved' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, status: user.status },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow certain fields to be updated
    const allowedUpdates = [
      'name', 'email', 'password', 'role', 'mobile',
      'address', 'country', 'state', 'city', 'pincode',
      'company', 'gstNumber'
    ];
    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // If password is updated, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const [updated] = await User.update(updates, { where: { id } });

    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = { register, login, updateUser };


module.exports = { register, login };
