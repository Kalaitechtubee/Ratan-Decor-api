'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface
      .describeTable('enquiries')
      .catch(() => null);

    if (!tableExists) {
      // If table doesn’t exist, create it fully
      await queryInterface.createTable('enquiries', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },

        // User Information
        userId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' }
        },
        userName: { type: Sequelize.STRING, allowNull: true },
        userEmail: { type: Sequelize.STRING, allowNull: true },
        userPhone: { type: Sequelize.STRING, allowNull: true },
        companyName: { type: Sequelize.STRING },
        userRole: {
          type: Sequelize.ENUM('General', 'Architect', 'Dealer', 'Interior Designer', 'Contractor', 'Builder', 'Other'),
          defaultValue: 'General'
        },

        // Location
        stateName: { type: Sequelize.STRING },
        cityName: { type: Sequelize.STRING },

        // Product Info
        productId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'products', key: 'id' }
        },
        productDesignNumber: { type: Sequelize.STRING },
        userType: { type: Sequelize.STRING },

        // Source & Status
        source: {
          type: Sequelize.ENUM('Email', 'WhatsApp', 'Phone', 'VideoCall', 'Website', 'Walk-in'),
          defaultValue: 'Website'
        },
        status: {
          type: Sequelize.ENUM('New', 'Pending', 'InProgress', 'Completed', 'Confirmed', 'Delivered', 'Rejected', 'Cancelled'),
          defaultValue: 'New',
        },
        isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
        priority: {
          type: Sequelize.ENUM('Low', 'Medium', 'High', 'Urgent'),
          defaultValue: 'Medium'
        },

        notes: Sequelize.TEXT,
        adminNotes: Sequelize.TEXT,

        // Video Call
        videoCallDateTime: Sequelize.DATE,
        videoCallStatus: {
          type: Sequelize.ENUM('Not Scheduled', 'Scheduled', 'Completed', 'Cancelled', 'Rescheduled'),
          defaultValue: 'Not Scheduled'
        },
        videoCallLink: Sequelize.STRING,
        videoCallNotes: Sequelize.TEXT,

        // Follow-up
        followUpDate: Sequelize.DATE,
        followUpNotes: Sequelize.TEXT,

        // Assignment
        assignedTo: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' }
        },

        // Tracking
        enquiryNumber: { type: Sequelize.STRING, unique: true },
        statusHistory: { type: Sequelize.JSON, defaultValue: [] },

        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });
    } else {
      // Add missing columns only
      const columns = await queryInterface.describeTable('enquiries');

      const columnsToAdd = [
        ['userName', { type: Sequelize.STRING, allowNull: true }],
        ['userEmail', { type: Sequelize.STRING, allowNull: true }],
        ['userPhone', { type: Sequelize.STRING, allowNull: true }],
        ['companyName', { type: Sequelize.STRING, allowNull: true }],
        ['userRole', {
          type: Sequelize.ENUM('General', 'Architect', 'Dealer', 'Interior Designer', 'Contractor', 'Builder', 'Other'),
          defaultValue: 'General'
        }],
        ['stateName', { type: Sequelize.STRING, allowNull: true }],
        ['cityName', { type: Sequelize.STRING, allowNull: true }],
        ['productDesignNumber', { type: Sequelize.STRING, allowNull: true }],
        ['isActive', { type: Sequelize.BOOLEAN, defaultValue: true }],
        ['priority', {
          type: Sequelize.ENUM('Low', 'Medium', 'High', 'Urgent'),
          defaultValue: 'Medium'
        }],
        ['adminNotes', { type: Sequelize.TEXT }],
        ['videoCallStatus', {
          type: Sequelize.ENUM('Not Scheduled', 'Scheduled', 'Completed', 'Cancelled', 'Rescheduled'),
          defaultValue: 'Not Scheduled'
        }],
        ['videoCallLink', { type: Sequelize.STRING }],
        ['videoCallNotes', { type: Sequelize.TEXT }],
        ['followUpDate', { type: Sequelize.DATE }],
        ['followUpNotes', { type: Sequelize.TEXT }],
        ['assignedTo', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'users', key: 'id' }
        }],
        ['enquiryNumber', { type: Sequelize.STRING, unique: true }],
        ['statusHistory', { type: Sequelize.JSON, defaultValue: [] }]
      ];

      for (const [name, def] of columnsToAdd) {
        if (!columns[name]) {
          await queryInterface.addColumn('enquiries', name, def);
        }
      }
    }

    // Add useful indexes
    await queryInterface.addIndex('enquiries', ['userEmail'], { name: 'idx_enquiries_user_email' });
    await queryInterface.addIndex('enquiries', ['userPhone'], { name: 'idx_enquiries_user_phone' });
    await queryInterface.addIndex('enquiries', ['status'], { name: 'idx_enquiries_status' });
    await queryInterface.addIndex('enquiries', ['userRole'], { name: 'idx_enquiries_user_role' });
    await queryInterface.addIndex('enquiries', ['isActive'], { name: 'idx_enquiries_is_active' });
    await queryInterface.addIndex('enquiries', ['createdAt'], { name: 'idx_enquiries_created_at' });
    await queryInterface.addIndex('enquiries', ['enquiryNumber'], { name: 'idx_enquiries_enquiry_number' });
  },

  down: async (queryInterface) => {
    const cols = [
      'userName','userEmail','userPhone','companyName','userRole',
      'stateName','cityName','productDesignNumber','isActive','priority',
      'adminNotes','videoCallStatus','videoCallLink','videoCallNotes',
      'followUpDate','followUpNotes','assignedTo','enquiryNumber','statusHistory'
    ];
    for (const c of cols) {
      await queryInterface.removeColumn('enquiries', c).catch(() => {});
    }

    await queryInterface.removeIndex('enquiries', 'idx_enquiries_user_email').catch(() => {});
    await queryInterface.removeIndex('enquiries', 'idx_enquiries_user_phone').catch(() => {});
    await queryInterface.removeIndex('enquiries', 'idx_enquiries_status').catch(() => {});
    await queryInterface.removeIndex('enquiries', 'idx_enquiries_user_role').catch(() => {});
    await queryInterface.removeIndex('enquiries', 'idx_enquiries_is_active').catch(() => {});
    await queryInterface.removeIndex('enquiries', 'idx_enquiries_created_at').catch(() => {});
    await queryInterface.removeIndex('enquiries', 'idx_enquiries_enquiry_number').catch(() => {});
  }
};
