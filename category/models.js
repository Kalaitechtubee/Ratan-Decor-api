const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
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
  userTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'user_types',
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
}, {
  tableName: 'categories',
  timestamps: false,
  indexes: [
    { fields: ['userTypeId'] },
    { fields: ['parentId'] },
    { unique: true, fields: ['name', 'userTypeId', 'parentId'] },
  ],
});

// Define association
Category.associate = (models) => {
  Category.belongsTo(models.UserType, { foreignKey: 'userTypeId', as: 'userType' });
};

module.exports = Category;