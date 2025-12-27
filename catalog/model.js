const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Catalog = sequelize.define(
    'Catalog',
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        filename: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        originalName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        path: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        mimeType: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        size: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        tableName: 'catalog',
        timestamps: true, // We want to know when it was updated
    }
);

module.exports = Catalog;
