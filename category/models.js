// models/Category.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Category name cannot be empty' },
      },
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Image filename for main categories only (subcategories cannot have images)',
    },
  },
  {
    tableName: 'categories',
    timestamps: false,
    indexes: [
      { fields: ['parentId'] },
      { unique: true, fields: ['name', 'parentId'] },
    ],
  }
);

// Define associations
Category.associate = (models) => {
  Category.hasMany(models.Product, {
    foreignKey: 'categoryId',
    as: 'products',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  Category.hasMany(models.Category, {
    foreignKey: 'parentId',
    as: 'subCategories',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  Category.belongsTo(models.Category, {
    foreignKey: 'parentId',
    as: 'parent',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

module.exports = Category;