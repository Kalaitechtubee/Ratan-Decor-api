const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductUsageType = sequelize.define("ProductUsageType", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  typeName: {
    type: DataTypes.STRING,
    allowNull: false,
    // Residential, Commercial, Modular Kitchen, Others
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: "product_usage_types",
  timestamps: true,
});

module.exports = ProductUsageType;