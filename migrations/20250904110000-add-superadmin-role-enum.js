'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Alter the role column to include 'SuperAdmin' in the ENUM values
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM(
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
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert the ENUM to the previous state (without 'SuperAdmin')
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM(
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
    });
  }
};
