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
    defaultValue: 0.00,
  },
  brandName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  warranty: {
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
}, {
  tableName: "products",
  timestamps: true,
});

module.exports = Product;