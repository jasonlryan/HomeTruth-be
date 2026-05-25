const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PropertyAddress = sequelize.define(
  "PropertyAddress",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    property_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "properties",
        key: "id",
      },
    },
    is_current: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    address_line_1: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    address_line_2: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    town_city: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    county: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    postcode: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: false,
      defaultValue: "GB",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    address_fingerprint: {
      type: DataTypes.CHAR(64),
      allowNull: true,
    },
    source_type: {
      type: DataTypes.ENUM(
        "manual",
        "user_profile",
        "listing",
        "partner_api",
        "import",
        "system"
      ),
      allowNull: false,
      defaultValue: "manual",
    },
    confidence: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
    },
    valid_from: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    valid_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    tableName: "property_addresses",
    underscored: true,
    timestamps: true,
  }
);

module.exports = PropertyAddress;
