const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PartnerCohort = sequelize.define(
  "PartnerCohort",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    partner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "partners",
        key: "id",
      },
    },
    cohort_key: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("planned", "active", "paused", "closed", "archived"),
      allowNull: false,
      defaultValue: "planned",
    },
    target_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    external_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reporting_level: {
      type: DataTypes.ENUM("none", "aggregate_only", "individual_with_consent"),
      allowNull: false,
      defaultValue: "aggregate_only",
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    tableName: "partner_cohorts",
    underscored: true,
    timestamps: true,
  }
);

module.exports = PartnerCohort;
