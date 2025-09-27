const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Contact = sequelize.define('Contact', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      is: /^[0-9+\-\s()]{7,15}$/ // Allow digits, spaces, dashes, parentheses, plus sign (7-15 chars)
    }
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
}, {
  tableName: 'contacts',
  timestamps: true
});

module.exports = Contact;