const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductUsageType = sequelize.define('ProductUsageType', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true }
}, {
  tableName: 'productUsageTypes',
  timestamps: false
});

module.exports = ProductUsageType;
