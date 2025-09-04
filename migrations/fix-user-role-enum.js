'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, update any invalid role values to 'General'
    await queryInterface.sequelize.query(`
      UPDATE users
      SET role = 'General'
      WHERE role NOT IN ('customer', 'General', 'Architect', 'Dealer', 'Admin', 'Manager', 'Sales', 'Support')
    `);

    // Then alter the column with the correct ENUM values
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
