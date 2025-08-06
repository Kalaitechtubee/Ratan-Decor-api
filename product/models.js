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
  price: { type: DataTypes.FLOAT },
  attributes: { type: DataTypes.JSON },
  isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: "products",
  timestamps: true,
});

Product.belongsTo(Category, { foreignKey: "categoryId" });
Product.belongsTo(Subcategory, { foreignKey: "subcategoryId" });
Product.belongsTo(UserType, { foreignKey: "userTypeId" });

module.exports = Product;
