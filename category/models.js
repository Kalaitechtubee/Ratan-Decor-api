// models/Category.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
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
  timestamps: false,
});

// Remove associations - they're now handled in models/index.js
// Category.associate = (models) => {
//   Category.hasMany(models.Category, {
//     as: 'SubCategories',
//     foreignKey: 'parentId',
//   });
//   Category.belongsTo(models.Category, {
//     as: 'Parent',
//     foreignKey: 'parentId',
//   });
// };

module.exports = Category;