// const { DataTypes } = require('sequelize');
// const sequelize = require('../config/database');

// const Category = sequelize.define(
//   'Category',
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       primaryKey: true,
//     },
//     name: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       validate: {
//         notEmpty: { msg: 'Category name cannot be empty' },
//       },
//     },
//     parentId: {
//       type: DataTypes.INTEGER,
//       allowNull: true,
//       references: {
//         model: 'categories',
//         key: 'id',
//       },
//       onDelete: 'CASCADE',
//       onUpdate: 'CASCADE',
//     },
//     userTypeId: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//       references: {
//         model: 'user_types',
//         key: 'id',
//       },
//       onDelete: 'CASCADE',
//       onUpdate: 'CASCADE',
//     },
//   },
//   {
//     tableName: 'categories',
//     timestamps: false, // Set to true if auditing is needed
//     indexes: [
//       { fields: ['userTypeId'] }, // Optimize queries by userTypeId
//       { fields: ['parentId'] }, // Optimize queries for subcategories
//       { unique: true, fields: ['name', 'userTypeId', 'parentId'] }, // Prevent duplicate names within userTypeId and parentId
//     ],
//   }
// );

// // Define associations
// Category.associate = (models) => {
//   // Belongs to UserType (for userTypeName)
//   Category.belongsTo(models.UserType, {
//     foreignKey: 'userTypeId',
//     as: 'userType',
//   });
//   // Has many Products
//   Category.hasMany(models.Product, {
//     foreignKey: 'categoryId',
//     as: 'products',
//     onDelete: 'CASCADE',
//     onUpdate: 'CASCADE',
//   });
//   // Self-referential hasMany for subcategories
//   Category.hasMany(models.Category, {
//     foreignKey: 'parentId',
//     as: 'subCategories',
//     onDelete: 'CASCADE',
//     onUpdate: 'CASCADE',
//   });
// };

// module.exports = Category;
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
    brandName: {
      type: DataTypes.STRING,
      allowNull: true,
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