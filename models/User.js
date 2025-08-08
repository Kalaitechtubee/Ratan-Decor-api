// models/User.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    // Existing fields (add these if not already present)
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // New userType field
    userType: {
      type: DataTypes.ENUM('residential', 'commercial', 'modular-kitchen', 'others'),
      allowNull: true,
    },
  }, {
    tableName: 'users', // Optional: specify table name if different
    timestamps: true,  // Adds createdAt and updatedAt fields
  });

  return User;
};