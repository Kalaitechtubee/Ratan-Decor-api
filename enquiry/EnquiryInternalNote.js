// enquiry/EnquiryInternalNote.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EnquiryInternalNote = sequelize.define('EnquiryInternalNote', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    enquiryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'enquiries', key: 'id' },
      onDelete: 'CASCADE',
    },
    staffUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: true },
    },
    noteType: {
      type: DataTypes.ENUM('Follow-up', 'Contact Attempt', 'Meeting Notes', 'Status Update', 'Other'),
      defaultValue: 'Follow-up',
      allowNull: false,
    },
    isImportant: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    followUpDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'products', key: 'id' },
      onDelete: 'SET NULL',
    },
  }, {
    tableName: 'enquiry_internal_notes',
    timestamps: true,
    underscored: false,
    indexes: [
      { fields: ['enquiryId'] },
      { fields: ['staffUserId'] },
      { fields: ['createdAt'] },
      { fields: ['isImportant'] },
      { fields: ['followUpDate'] },
    ],
  });

  return EnquiryInternalNote;
};