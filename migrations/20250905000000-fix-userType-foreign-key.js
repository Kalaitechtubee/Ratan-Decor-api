'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint on userType if exists
    await queryInterface.removeConstraint('enquiries', 'enquiries_ibfk_3').catch(() => {});

    // Change userType column to STRING type without foreign key
    await queryInterface.changeColumn('enquiries', 'userType', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'General',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert userType column to ENUM or previous type if needed
    await queryInterface.changeColumn('enquiries', 'userType', {
      type: Sequelize.ENUM('Residential', 'Commercial', 'Modular Kitchen', 'Others'),
      allowNull: false,
    });

    // Re-add foreign key constraint if necessary (optional)
    // await queryInterface.addConstraint('enquiries', {
    //   fields: ['userType'],
    //   type: 'foreign key',
    //   name: 'enquiries_ibfk_3',
    //   references: {
    //     table: 'UserTypes',
    //     field: 'id',
    //   },
    //   onDelete: 'SET NULL',
    //   onUpdate: 'CASCADE',
    // });
  }
};
