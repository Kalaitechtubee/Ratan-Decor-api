'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add missing columns to enquiries table
    const columnsToAdd = [
      {
        name: 'name',
        type: Sequelize.STRING,
        allowNull: false,
      },
      {
        name: 'email',
        type: Sequelize.STRING,
        allowNull: false,
      },
      {
        name: 'phoneNo',
        type: Sequelize.STRING,
        allowNull: false,
      },
      {
        name: 'companyName',
        type: Sequelize.STRING,
        allowNull: true,
      },
      {
        name: 'state',
        type: Sequelize.STRING,
        allowNull: false,
      },
      {
        name: 'city',
        type: Sequelize.STRING,
        allowNull: false,
      },
      {
        name: 'role',
        type: Sequelize.ENUM(
          "Customer",
          "Architect",
          "Dealer",
          "Admin",
          "Manager",
          "Sales",
          "Support"
        ),
        allowNull: false,
        defaultValue: "Customer",
      },
      {
        name: 'userType',
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
        references: { model: "UserTypes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      {
        name: 'pincode',
        type: Sequelize.STRING,
        allowNull: true,
      },
      {
        name: 'videoCallDate',
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      {
        name: 'videoCallTime',
        type: Sequelize.TIME,
        allowNull: true,
      }
    ];

    // Update userId to allow null
    await queryInterface.changeColumn('enquiries', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Update source enum to include WebSite
    await queryInterface.changeColumn('enquiries', 'source', {
      type: Sequelize.ENUM("Email", "WhatsApp","WebSite", "Phone", "VideoCall"),
      allowNull: false,
      defaultValue: "Email",
    });

    // Add missing columns
    for (const column of columnsToAdd) {
      try {
        await queryInterface.addColumn('enquiries', column.name, {
          type: column.type,
          allowNull: column.allowNull,
          defaultValue: column.defaultValue,
          references: column.references,
          onUpdate: column.onUpdate,
          onDelete: column.onDelete,
        });
      } catch (error) {
        console.log(`Column ${column.name} may already exist:`, error.message);
      }
    }

    // Remove old videoCallDateTime column if exists
    try {
      await queryInterface.removeColumn('enquiries', 'videoCallDateTime');
    } catch (error) {
      console.log('videoCallDateTime column may not exist:', error.message);
    }

    // Update userType enum to match new values
    try {
      await queryInterface.changeColumn('enquiries', 'userType', {
        type: Sequelize.ENUM('Residential', 'Commercial', 'Modular Kitchen', 'Others'),
        allowNull: false,
      });
    } catch (error) {
      console.log('userType enum update may not be needed:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove added columns
    const columnsToRemove = [
      'name', 'email', 'phoneNo', 'companyName', 'state', 'city', 'role', 'pincode', 'videoCallDate', 'videoCallTime'
    ];

    for (const column of columnsToRemove) {
      try {
        await queryInterface.removeColumn('enquiries', column);
      } catch (error) {
        console.log(`Column ${column} may not exist:`, error.message);
      }
    }

    // Revert userId to not null
    await queryInterface.changeColumn('enquiries', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    });

    // Revert source enum
    await queryInterface.changeColumn('enquiries', 'source', {
      type: Sequelize.ENUM('Email', 'WhatsApp', 'Phone', 'VideoCall'),
      allowNull: false,
    });
  }
};
