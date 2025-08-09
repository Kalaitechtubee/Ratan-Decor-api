// models/User.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    // Full name of the user
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Email address (must be unique)
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },

    // Hashed password
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // User type (optional field)
    userType: {
      type: DataTypes.ENUM(
        'Residential',
        'Commercial',
        'Modular Kitchen',
        'Others'
      ),
      allowNull: true,
    },
  }, {
    tableName: 'users', // DB table name
    timestamps: true,   // createdAt & updatedAt
  });

  return User;
};
