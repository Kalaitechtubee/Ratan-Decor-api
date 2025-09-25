'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, update any invalid role values to 'General'
    await queryInterface.sequelize.query(`
      UPDATE users
      SET role = 'customer'
      WHERE role NOT IN ('customer', 'architect', 'dealer', 'admin', 'manager', 'sales', 'support')
    `);

    // Then alter the column with the correct ENUM values
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM(
        'customer',
        'architect',
        'dealer',
        'admin',
        'manager',
        'sales',
        'support'
      ),
      allowNull: false,
      defaultValue: 'customer'
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
