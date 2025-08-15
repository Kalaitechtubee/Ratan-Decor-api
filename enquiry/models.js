const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Enquiry = sequelize.define("Enquiry", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  userType: {
    type: DataTypes.ENUM('Residential', 'Commercial', 'Modular Kitchen', 'Others'),
    allowNull: false,
  },
  source: {
    type: DataTypes.ENUM('Email', 'WhatsApp', 'Phone', 'VideoCall'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('New', 'InProgress', 'Confirmed', 'Delivered', 'Rejected'),
    defaultValue: 'New',
  },
  notes: {
    type: DataTypes.TEXT,
  },
  videoCallDateTime: {
    type: DataTypes.DATE,
  },
}, {
  tableName: "enquiries",
  timestamps: false,
});

module.exports = Enquiry;
