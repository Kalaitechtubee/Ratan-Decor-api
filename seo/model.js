const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Seo = sequelize.define("Seo", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  pageName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  keywords: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "seo",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['pageName'],
      name: 'seo_page_name_unique'
    }
  ]
});

module.exports = Seo;
