'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add brandName column to categories table
    await queryInterface.addColumn('categories', 'brandName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove brandName column from categories table
    await queryInterface.removeColumn('categories', 'brandName');
  }
};