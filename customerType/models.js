const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CustomerType = sequelize.define("CustomerType", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  typeName: {
    type: DataTypes.STRING,
    allowNull: false,
    // General, Architect, Dealer
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  discountPercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0, // For future discount calculations
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