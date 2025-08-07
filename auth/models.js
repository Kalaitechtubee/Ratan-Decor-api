const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const UserType = require("../userType/models");
const CustomerType = require("../customerType/models");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mobile: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pincode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userTypeId: {
    type: DataTypes.INTEGER,
    references: { model: "UserTypes", key: "id" },
  },
  customerTypeId: {
    type: DataTypes.INTEGER,
    references: { model: "CustomerTypes", key: "id" },
  },
}, {
  tableName: "users",
  timestamps: true,
});

// Associations
User.belongsTo(UserType, { foreignKey: "userTypeId" });
User.belongsTo(CustomerType, { foreignKey: "customerTypeId" });

module.exports = User;