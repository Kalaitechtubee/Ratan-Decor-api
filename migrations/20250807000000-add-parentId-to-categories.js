"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Categories", "parentId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Categories",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Categories", "parentId");
  }
};
