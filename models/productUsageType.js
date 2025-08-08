const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductUsageType = sequelize.define("ProductUsageType", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: "product_usage_types",
  timestamps: true,
});

module.exports = ProductUsageType;
