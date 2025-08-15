'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable('order_items');

      if (!table.subtotal) {
        await queryInterface.addColumn('order_items', 'subtotal', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
        }, { transaction: t });
      }
      if (!table.gstRate) {
        await queryInterface.addColumn('order_items', 'gstRate', {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: true,
          defaultValue: 0.00,
        }, { transaction: t });
      }
      if (!table.gstAmount) {
        await queryInterface.addColumn('order_items', 'gstAmount', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
          defaultValue: 0.00,
        }, { transaction: t });
      }
      if (!table.total) {
        await queryInterface.addColumn('order_items', 'total', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
        }, { transaction: t });
      }
      if (!table.productSnapshot) {
        await queryInterface.addColumn('order_items', 'productSnapshot', {
          type: Sequelize.JSON,
          allowNull: true,
        }, { transaction: t });
      }

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  down: async (queryInterface) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable('order_items');
      const drop = async (name) => table[name] && queryInterface.removeColumn('order_items', name, { transaction: t });
      await drop('productSnapshot');
      await drop('total');
      await drop('gstAmount');
      await drop('gstRate');
      await drop('subtotal');
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },
};
