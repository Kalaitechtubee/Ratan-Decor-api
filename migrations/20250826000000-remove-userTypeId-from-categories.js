'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Remove userTypeId column from categories table
    try {
      // Try to find the actual constraint name
      const [results] = await queryInterface.sequelize.query(
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'categories' AND COLUMN_NAME = 'userTypeId' AND REFERENCED_TABLE_NAME IS NOT NULL;"
      );
      
      // If constraint exists, remove it
      if (results.length > 0) {
        await queryInterface.removeConstraint('categories', results[0].CONSTRAINT_NAME);
      }
    } catch (error) {
      console.log('No foreign key constraint found or error removing constraint:', error.message);
    }
    
    // Remove the column regardless of constraint
    try {
      await queryInterface.removeColumn('categories', 'userTypeId');
    } catch (error) {
      console.log('Error removing userTypeId column:', error.message);
      // Column might not exist, which is fine
    }
  },

  async down (queryInterface, Sequelize) {
    // Add userTypeId column back to categories table
    try {
      await queryInterface.addColumn('categories', 'userTypeId', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user_types',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      console.log('userTypeId column added back to categories table');
    } catch (error) {
      console.log('Error adding userTypeId column back:', error.message);
    }
  }
};