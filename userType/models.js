const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserType = sequelize.define("UserType", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: "user_types",
  timestamps: true,
});

module.exports = UserType;