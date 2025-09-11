'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change the role ENUM in enquiries table to replace 'Customer' with 'General'
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Remove old ENUM type
      await queryInterface.sequelize.query('ALTER TYPE "enum_enquiries_role" RENAME TO "enum_enquiries_role_old";', { transaction });

      // Create new ENUM type with updated values
      await queryInterface.sequelize.query(`
        CREATE TYPE "enum_enquiries_role" AS ENUM (
          'General',
          'Architect',
          'Dealer',
          'Admin',
          'Manager',
          'Sales',
          'Support'
        );
      `, { transaction });

      // Alter the column to use the new ENUM type
      await queryInterface.sequelize.query(`
        ALTER TABLE "enquiries" ALTER COLUMN "role" TYPE "enum_enquiries_role" USING "role"::text::enum_enquiries_role;
      `, { transaction });

      // Drop the old ENUM type
      await queryInterface.sequelize.query('DROP TYPE "enum_enquiries_role_old";', { transaction });
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert ENUM type change
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('ALTER TYPE "enum_enquiries_role" RENAME TO "enum_enquiries_role_new";', { transaction });

      await queryInterface.sequelize.query(`
        CREATE TYPE "enum_enquiries_role" AS ENUM (
          'Customer',
          'Architect',
          'Dealer',
          'Admin',
          'Manager',
          'Sales',
          'Support'
        );
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE "enquiries" ALTER COLUMN "role" TYPE "enum_enquiries_role" USING "role"::text::enum_enquiries_role;
      `, { transaction });

      await queryInterface.sequelize.query('DROP TYPE "enum_enquiries_role_new";', { transaction });
    });
  }
};
