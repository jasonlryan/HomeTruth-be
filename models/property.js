const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Property = sequelize.define(
  "Property",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    uprn: {
      type: DataTypes.STRING(32),
      allowNull: true,
      unique: true,
    },
    property_type: {
      type: DataTypes.ENUM(
        "house",
        "flat",
        "maisonette",
        "bungalow",
        "commercial",
        "land",
        "mixed_use",
        "unknown"
      ),
      allowNull: false,
      defaultValue: "unknown",
    },
    tenure: {
      type: DataTypes.ENUM(
        "freehold",
        "leasehold",
        "share_of_freehold",
        "commonhold",
        "unknown"
      ),
      allowNull: false,
      defaultValue: "unknown",
    },
    lifecycle_status: {
      type: DataTypes.ENUM(
        "unverified",
        "active",
        "archived",
        "merged",
        "deleted"
      ),
      allowNull: false,
      defaultValue: "unverified",
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
    source_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    tableName: "properties",
    underscored: true,
    timestamps: true,
  }
);

module.exports = Property;
