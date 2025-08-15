const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CustomerType = sequelize.define("CustomerType", {
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
  tableName: "customer_types",
  timestamps: true,
});

module.exports = CustomerType;
