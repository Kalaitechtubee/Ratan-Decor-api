// // backend/product/models.js
// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/database");
// const Category = require("../category/models");
// const Subcategory = require("../subcategory/models");
// const CustomerType = require("../customerType/models");
// const ProductUsageType = require("../productUsageType/models");

// const Product = sequelize.define("Product", {
//   id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
//   title: { type: DataTypes.STRING, allowNull: false },
//   description: { type: DataTypes.TEXT },
//   imageUrl: { type: DataTypes.STRING },
//   attributes: { type: DataTypes.JSON },
//   isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },

//   // Base price (before any customer type discounts)
//   basePrice: { type: DataTypes.FLOAT, allowNull: false },

//   // Optional: Store specific prices for different customer types
//   generalPrice: { type: DataTypes.FLOAT },
//   architectPrice: { type: DataTypes.FLOAT },
//   dealerPrice: { type: DataTypes.FLOAT },

//   // Foreign Keys
//   categoryId: { type: DataTypes.INTEGER, allowNull: true },
//   subcategoryId: { type: DataTypes.INTEGER, allowNull: true },
//   productUsageTypeId: { type: DataTypes.INTEGER, allowNull: false }, // Required
// }, {
//   tableName: "products",
//   timestamps: true,
// });

// // Associations
// Product.belongsTo(Category, { foreignKey: "categoryId" });
// Product.belongsTo(Subcategory, { foreignKey: "subcategoryId" });
// Product.belongsTo(ProductUsageType, { 
//   foreignKey: "productUsageTypeId",
//   as: "ProductUsageType"
// });

// module.exports = Product;
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

  basePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, // ✅ Added
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
