// models/videoCallInternalNote.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VideoCallInternalNote = sequelize.define('VideoCallInternalNote', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    enquiryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'videocallenquiries', key: 'id' },
      onDelete: 'CASCADE',
    },
    staffUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
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
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'products', key: 'id' },
    },
  }, {
    tableName: 'videocall_internal_notes',
    timestamps: true,
    underscored: false,
  });

  return VideoCallInternalNote;
};