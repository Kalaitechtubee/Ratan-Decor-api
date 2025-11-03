'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_types', 'icon', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Icon filename for user types',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('user_types', 'icon');
  }
};
