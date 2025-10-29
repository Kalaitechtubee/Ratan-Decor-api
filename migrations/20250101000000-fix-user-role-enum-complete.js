'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, update any invalid role values to 'customer'
    await queryInterface.sequelize.query(`
      UPDATE users
      SET role = 'customer'
      WHERE role NOT IN ('customer', 'General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support', 'SuperAdmin')
    `);

    // Then alter the column with the correct ENUM values matching the model
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
    // Revert the ENUM to a previous state if needed
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'General'
    });
  }
};
