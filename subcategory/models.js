const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
// Delay importing Category until after Subcategory is defined to avoid circular issues
let Category;

const Subcategory = sequelize.define("Subcategory", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  categoryId: {
    type: DataTypes.INTEGER,
    references: {
      model: "categories",
      key: "id",
    },
  },
}, {
  tableName: "subcategories",
  timestamps: true,
});

// Import Category after Subcategory is defined
Category = require("../category/models");

// Set up associations
Subcategory.belongsTo(Category, { foreignKey: "categoryId" });
Category.hasMany(Subcategory, { foreignKey: "categoryId" });

module.exports = Subcategory;