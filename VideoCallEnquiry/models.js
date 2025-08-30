// VideoCallEnquiry/models.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VideoCallEnquiry = sequelize.define('VideoCallEnquiry', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'products', 
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    phoneNo: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    videoCallDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    videoCallTime: {
      type: DataTypes.TIME,
      allowNull: false
    },
    source: {
      type: DataTypes.STRING,
      defaultValue: 'VideoCall'
    },
    status: {
      type: DataTypes.ENUM('New', 'Scheduled', 'Completed', 'Cancelled'),
      defaultValue: 'New'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'videocallenquiries', // ✅ Explicitly set table name
    timestamps: true,
    underscored: false
  });

  return VideoCallEnquiry;
};