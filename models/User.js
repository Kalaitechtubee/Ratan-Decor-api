// models/User.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    // Full name of the user
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },

    // Email address (must be unique)
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },

    // Hashed password
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },

    // User role (e.g., Admin, Architect, Dealer, etc.)
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'User',
      validate: {
        notEmpty: true
      }
    },

    // User status (e.g., Pending, Approved, Rejected)
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Pending',
      validate: {
        notEmpty: true,
        isIn: [['Pending', 'Approved', 'Rejected']]
      }
    },

    // Foreign key to UserType model
    userTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'UserTypes',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    }
  }, {
    tableName: 'users', // DB table name
    timestamps: true,   // createdAt & updatedAt
  });

  return User;
};