'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Drop all existing indexes on users table to clean up
    await queryInterface.sequelize.query('SHOW INDEX FROM users;').then(async (indexes) => {
      for (const index of indexes[0]) {
        if (index.Key_name !== 'PRIMARY') {
          await queryInterface.removeIndex('users', index.Key_name);
        }
      }
    });

    // Recreate only the necessary indexes
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique'
    });

    await queryInterface.addIndex('users', ['role'], {
      name: 'users_role_index'
    });

    await queryInterface.addIndex('users', ['status'], {
      name: 'users_status_index'
    });

    await queryInterface.addIndex('users', ['createdAt'], {
      name: 'users_created_at_index'
    });
  },

  async down (queryInterface, Sequelize) {
    // Drop the indexes we created
    await queryInterface.removeIndex('users', 'users_email_unique');
    await queryInterface.removeIndex('users', 'users_role_index');
    await queryInterface.removeIndex('users', 'users_status_index');
    await queryInterface.removeIndex('users', 'users_created_at_index');
  }
};
