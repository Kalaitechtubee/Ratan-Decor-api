'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'unitType', {
      type: Sequelize.ENUM('Per Sheet', 'Per Square Feet'),
      allowNull: true,
      defaultValue: 'Per Sheet'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('products', 'unitType');
  }
};
