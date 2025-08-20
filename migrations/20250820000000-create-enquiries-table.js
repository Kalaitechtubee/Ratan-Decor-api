'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('enquiries', {
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
        allowNull: true,
        references: {
          model: 'products',
          key: 'id'
        }
      },
      userType: {
        type: Sequelize.ENUM('Residential', 'Commercial', 'Modular Kitchen', 'Others'),
        allowNull: false,
      },
      source: {
        type: Sequelize.ENUM('Email', 'WhatsApp', 'Phone', 'VideoCall'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('New', 'InProgress', 'Confirmed', 'Delivered', 'Rejected'),
        defaultValue: 'New',
      },
      notes: {
        type: Sequelize.TEXT,
      },
      videoCallDateTime: {
        type: Sequelize.DATE,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('enquiries');
  }
};