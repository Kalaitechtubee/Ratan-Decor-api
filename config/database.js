const { Sequelize } = require("sequelize");
require("dotenv").config(); // Load env variables

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    logging: false, // optional: disables SQL logging
  }
);

module.exports = sequelize;
