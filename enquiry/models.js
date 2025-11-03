// enquiry/models.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Enquiry = sequelize.define(
    'Enquiry',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'products',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
          notEmpty: true,
        },
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      userType: {
        type: DataTypes.INTEGER,
        allowNull: true, // ✅ FIXED: Changed to true to allow SET NULL on foreign key
        references: {
          model: 'user_types',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'in-progress', 'resolved', 'closed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium',
        allowNull: false,
      },
      assignedTo: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      resolutionDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      source: {
        type: DataTypes.ENUM('website', 'phone', 'email', 'chat', 'social-media', 'other'),
        defaultValue: 'website',
        allowNull: false,
      },
    },
    {
      tableName: 'enquiries',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['productId'] },
        { fields: ['status'] },
        { fields: ['priority'] },
        { fields: ['assignedTo'] },
        { fields: ['createdAt'] },
        { fields: ['userType'] },
      ],
    }
  );

  return Enquiry;
};