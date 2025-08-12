'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add colors column
    await queryInterface.addColumn('products', 'colors', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });

    // Add gst column
    await queryInterface.addColumn('products', 'gst', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0.00,
    });

    // Add multiple images support
    await queryInterface.addColumn('products', 'images', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    });

    // Add rating fields
    await queryInterface.addColumn('products', 'averageRating', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 0.00,
    });

    await queryInterface.addColumn('products', 'totalRatings', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });

    // Create product_ratings table
    await queryInterface.createTable('product_ratings', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        }
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      review: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      }
    });

    // Add unique constraint to prevent multiple ratings from same user for same product
    await queryInterface.addIndex('product_ratings', ['userId', 'productId'], {
      unique: true,
      name: 'product_ratings_user_product_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove columns from products table
    await queryInterface.removeColumn('products', 'colors');
    await queryInterface.removeColumn('products', 'gst');
    await queryInterface.removeColumn('products', 'images');
    await queryInterface.removeColumn('products', 'averageRating');
    await queryInterface.removeColumn('products', 'totalRatings');

    // Drop product_ratings table
    await queryInterface.dropTable('product_ratings');
  }
};

