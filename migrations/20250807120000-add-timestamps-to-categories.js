"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Categories', 'createdAt', {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    await queryInterface.addColumn('Categories', 'updatedAt', {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Categories', 'createdAt');
    await queryInterface.removeColumn('Categories', 'updatedAt');
  }
};
