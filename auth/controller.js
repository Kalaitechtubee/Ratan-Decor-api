const User = require("./models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

// REGISTER
const register = async (req, res) => {
  try {
    const {
      name, email, password, mobile,
      userTypeId, customerTypeId,
      address, country, state, city, pincode
    } = req.body;

    // Required fields validation
    if (!name || !email || !password || !mobile || !userTypeId || !customerTypeId) {
      return res.status(400).json({ error: "All required fields must be provided." });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      userTypeId,
      customerTypeId,
      address,
      country,
      state,
      city,
      pincode
    });

    // JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, userTypeId: user.userTypeId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Success response
    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        userTypeId: user.userTypeId,
        customerTypeId: user.customerTypeId,
        address: user.address,
        country: user.country,
        state: user.state,
        city: user.city,
        pincode: user.pincode
      },
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, userTypeId: user.userTypeId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        userTypeId: user.userTypeId,
        customerTypeId: user.customerTypeId,
        address: user.address,
        country: user.country,
        state: user.state,
        city: user.city,
        pincode: user.pincode
      },
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// FORGOT PASSWORD (Mock)
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // In a real implementation, you would send a reset link or OTP here
    res.status(200).json({ message: "Reset instructions sent to email (mocked)." });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login, forgotPassword };