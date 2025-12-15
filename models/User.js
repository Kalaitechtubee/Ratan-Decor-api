
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {

    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true, len: [1, 255] }
    },


    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true, notEmpty: true }
    },


    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true }
    },


    role: {
      type: DataTypes.ENUM(
        'customer',
        'General',
        'Architect',
        'Dealer',
        'Admin',
        'Manager',
        'Sales',
        'Support',
        'SuperAdmin'
      ),
      allowNull: false,
      defaultValue: 'General'
    },


    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending'
    },


    mobile: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.STRING, allowNull: true },
    country: { type: DataTypes.STRING, allowNull: true },
    state: { type: DataTypes.STRING, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: true },
    pincode: { type: DataTypes.STRING, allowNull: true },
    company: { type: DataTypes.STRING, allowNull: true },


    userTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'UserType',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

   
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },

    
    loginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },


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
