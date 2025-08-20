'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // This migration doesn't directly modify the database
    // It's a reminder to manually update the category controller
    console.log('IMPORTANT: You need to manually update the category/controller.js file to remove userTypeId references');
    return;
  },

  async down (queryInterface, Sequelize) {
    // No database changes to revert
    return;
  }
};