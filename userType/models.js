// backend/userType/models.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserType = sequelize.define("UserType", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  typeName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Ensure uniqueness
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = UserType;
