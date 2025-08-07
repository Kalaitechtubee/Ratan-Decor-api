const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const register = async (req, res) => {
  try {
    const {
      name, email, password, role,
      mobile, address, country, state, city, pincode,
      userTypeId, customerTypeId
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'General',
      status: (role === 'Architect' || role === 'Dealer') ? 'Pending' : 'Approved',
      mobile,
      address,
      country,
      state,
      city,
      pincode,
      userTypeId,
      customerTypeId
    });

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
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

module.exports = { register, login };
