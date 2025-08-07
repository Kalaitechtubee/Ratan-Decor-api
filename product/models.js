
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Category = require("../category/models");

const Product = sequelize.define("Product", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  image: { type: DataTypes.STRING },
  specifications: { type: DataTypes.JSON },
  visibleTo: {
    type: DataTypes.JSON,
    defaultValue: ['Residential', 'Commercial', 'Modular Kitchen', 'Others'],
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },

  basePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  generalPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  architectPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  dealerPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },


  categoryId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: "products",
  timestamps: true,
});


Product.belongsTo(Category, { foreignKey: "categoryId" });

module.exports = Product;
