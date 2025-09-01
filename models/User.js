// models/User.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    // Full name
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true, len: [1, 255] }
    },

    // Email (unique)
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true, notEmpty: true }
    },

    // Hashed password
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true }
    },

    // Role
    role: {
      type: DataTypes.ENUM(
        'customer',
        'General',
        'Architect',
        'Dealer',
        'Admin',
        'Manager',
        'Sales',
        'Support'
      ),
      allowNull: false,
      defaultValue: 'General'
    },

    // Status
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending'
    },

    // Contact & company details
    mobile: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.STRING, allowNull: true },
    country: { type: DataTypes.STRING, allowNull: true },
    state: { type: DataTypes.STRING, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: true },
    pincode: { type: DataTypes.STRING, allowNull: true },
    company: { type: DataTypes.STRING, allowNull: true },

    // FK to UserType
    userTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'UserTypes',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },

    // NEW FIELDS --------------------------------------

    // User created by (self-referencing FK)
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users', // self-reference
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },

    // Rejection reason (when status = Rejected)
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // Track last login
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Login attempt count
    loginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },

    // Account lock timestamp
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true
    }

  }, {
    tableName: 'users',
    timestamps: true
  });

  return User;
};
