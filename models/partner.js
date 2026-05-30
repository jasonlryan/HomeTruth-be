const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Partner = sequelize.define(
  "Partner",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    partner_type: {
      type: DataTypes.ENUM(
        "insurer",
        "lender",
        "estate_agent",
        "property_developer",
        "other"
      ),
      allowNull: false,
      defaultValue: "insurer",
    },
    status: {
      type: DataTypes.ENUM("active", "paused", "archived"),
      allowNull: false,
      defaultValue: "active",
    },
    external_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reporting_mode: {
      type: DataTypes.ENUM("none", "aggregate_only", "individual_with_consent"),
      allowNull: false,
      defaultValue: "aggregate_only",
    },
  },
  {
    tableName: "partners",
    underscored: true,
    timestamps: true,
  }
);

module.exports = Partner;
