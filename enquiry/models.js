// models/Enquiry.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Enquiry = sequelize.define(
  "Enquiry",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Products", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Name cannot be empty" },
        len: { args: [2, 100], msg: "Name must be between 2 and 100 characters" },
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: { msg: "Please provide a valid email address" },
        notEmpty: { msg: "Email cannot be empty" },
      },
    },
    phoneNo: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Phone number cannot be empty" },
        isPhoneNumber(value) {
          const cleanPhone = value.replace(/[^\d]/g, "");
          if (cleanPhone.length < 10 || cleanPhone.length > 15) {
            throw new Error("Phone number must be between 10–15 digits");
          }
        },
      },
    },
    companyName: { type: DataTypes.STRING, allowNull: true },
    state: { type: DataTypes.STRING, allowNull: false },
    city: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM(
        "Customer",
        "Architect",
        "Dealer",
        "Admin",
        "Manager",
        "Sales",
        "Support"
      ),
      allowNull: false,
      defaultValue: "Customer",
    },
    userType: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1, // will point to "General"
      references: { model: "UserTypes", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    source: {
      type: DataTypes.ENUM("Email", "WhatsApp", "Phone", "VideoCall"),
      allowNull: false,
      defaultValue: "Email",
    },
    status: {
      type: DataTypes.ENUM(
        "New",
        "InProgress",
        "Confirmed",
        "Delivered",
        "Rejected"
      ),
      allowNull: false,
      defaultValue: "New",
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    videoCallDate: { type: DataTypes.DATEONLY, allowNull: true },
    videoCallTime: { type: DataTypes.TIME, allowNull: true },

    pincode: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isPincode(value) {
          if (value && !/^\d{6}$/.test(value)) {
            throw new Error("Pincode must be a 6-digit number");
          }
        },
      },
    },
  },
  {
    tableName: "enquiries",
    timestamps: true,
    indexes: [
      { fields: ["email"] },
      { fields: ["phoneNo"] },
      { fields: ["status"] },
      { fields: ["state", "city"] },
      { fields: ["createdAt"] },
      { fields: ["pincode"] },
    ],
  }
);

module.exports = Enquiry;
