// models/UserType.js
module.exports = (sequelize, DataTypes) => {
  const UserType = sequelize.define(
    "UserType",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 50],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      icon: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Icon filename for user types',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: 'user_types',

      timestamps: true,


      indexes: [
        {
          unique: true,
          fields: ["name"],
          name: "unique_user_type_name",
        },
      ],
    }
  );

  return UserType;
};
