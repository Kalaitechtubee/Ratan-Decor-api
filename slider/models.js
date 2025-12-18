const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Slider = sequelize.define(
  'Slider',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    subtitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Subtitle/badge text for the slider',
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Title cannot be empty' },
      },
      comment: 'Main title text for the slider',
    },
    desc: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description text for the slider',
    },
    cta: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Call to action text for the slider',
    },
    ctaUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL to navigate when CTA button is clicked',
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of image filenames (up to 5 images)',
      get() {
        const value = this.getDataValue('images');
        return value ? (Array.isArray(value) ? value : JSON.parse(value)) : [];
      },
      set(value) {
        this.setDataValue('images', Array.isArray(value) ? JSON.stringify(value) : value);
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether the slider is active and should be displayed',
    },
  },
  {
    tableName: 'sliders',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['isActive'] },
    ],
  }
);

module.exports = Slider;