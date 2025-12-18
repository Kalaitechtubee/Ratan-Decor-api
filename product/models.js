// models/Product.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Product = sequelize.define("Product", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  image: {
    type: DataTypes.STRING
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  specifications: {
    type: DataTypes.JSON
  },
  visibleTo: {
    type: DataTypes.JSON,
    defaultValue: ['Residential', 'Commercial', 'Modular Kitchen', 'Others'],
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  mrpPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  generalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  architectPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  dealerPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  designNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  size: {
    type: DataTypes.STRING,
    allowNull: true
  },
  thickness: {
    type: DataTypes.STRING,
    allowNull: true
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'categories',
      key: 'id'
    }
  },
  colors: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  gst: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: null,
  },
  brandName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  averageRating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  totalRatings: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  unitType: {
    type: DataTypes.ENUM('Per Sheet', 'Per Square Feet'),
    allowNull: true,
    defaultValue: 'Per Sheet',
  },
}, {
  tableName: "products",
  timestamps: true,
});

module.exports = Product;