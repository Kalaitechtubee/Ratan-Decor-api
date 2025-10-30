'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('UserTypes', 'icon', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Icon filename for user types',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('UserTypes', 'icon');
  }
};
