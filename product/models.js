const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Category = require("../category/models");
const Subcategory = require("../subcategory/models");
const UserType = require("../userType/models");

const Product = sequelize.define("Product", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  imageUrl: { type: DataTypes.STRING },
  attributes: { type: DataTypes.JSON },
  isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
  userTypeId: { type: DataTypes.INTEGER, allowNull: false },

  // Pricing for different user types
  generalPrice: { type: DataTypes.FLOAT, allowNull: false },
  architectPrice: { type: DataTypes.FLOAT, allowNull: false },
  dealerPrice: { type: DataTypes.FLOAT, allowNull: false },
}, {
  tableName: "products",
  timestamps: true,
});

// Associations
Product.belongsTo(Category, { foreignKey: "categoryId" });
Product.belongsTo(Subcategory, { foreignKey: "subcategoryId" });
Product.belongsTo(UserType, { foreignKey: "userTypeId" });

module.exports = Product;
