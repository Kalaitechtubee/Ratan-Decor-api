'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add phoneNumber column
    await queryInterface.addColumn('contacts', 'phoneNumber', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // Add location column
    await queryInterface.addColumn('contacts', 'location', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // Add createdAt and updatedAt columns (handled by Sequelize timestamps)
    await queryInterface.addColumn('contacts', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    await queryInterface.addColumn('contacts', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove columns from contacts table
    await queryInterface.removeColumn('contacts', 'phoneNumber');
    await queryInterface.removeColumn('contacts', 'location');
    await queryInterface.removeColumn('contacts', 'createdAt');
    await queryInterface.removeColumn('contacts', 'updatedAt');
  }
};
