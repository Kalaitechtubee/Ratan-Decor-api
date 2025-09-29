'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if column already exists
      const tableDescription = await queryInterface.describeTable('categories');

      if (!tableDescription.image) {
        await queryInterface.addColumn('categories', 'image', {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Image filename for main categories only (subcategories cannot have images)'
        });
        console.log('✅ Image column added to categories table successfully');
      } else {
        console.log('✅ Image column already exists in categories table');
      }
    } catch (error) {
      console.error('❌ Error adding image column to categories:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('categories', 'image');
      console.log('✅ Image column removed from categories table successfully');
    } catch (error) {
      console.error('❌ Error removing image column from categories:', error);
      throw error;
    }
  }
};
