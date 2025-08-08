// models/Category.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'categories',
  timestamps: false, // Explicitly disable timestamps to match your existing schema
});

Category.associate = (models) => {
  Category.hasMany(models.Category, {
    as: 'SubCategories',
    foreignKey: 'parentId',
  });
  Category.belongsTo(models.Category, {
    as: 'Parent',
    foreignKey: 'parentId',
  });
};

module.exports = Category;