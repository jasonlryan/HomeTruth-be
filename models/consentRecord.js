const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ConsentRecord = sequelize.define(
  "ConsentRecord",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    partner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "partners",
        key: "id",
      },
    },
    partner_cohort_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "partner_cohorts",
        key: "id",
      },
    },
    cohort_member_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "cohort_members",
        key: "id",
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    property_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "properties",
        key: "id",
      },
    },
    consent_scope: {
      type: DataTypes.ENUM(
        "hometruth_processing",
        "partner_reporting",
        "partner_contact_servicing",
        "individual_report_access",
        "aggregate_analytics"
      ),
      allowNull: false,
    },
    consent_type: {
      type: DataTypes.ENUM(
        "processing",
        "reporting",
        "contact",
        "report_access",
        "analytics"
      ),
      allowNull: false,
    },
    consent_version: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    consent_text_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("granted", "withdrawn", "expired", "superseded"),
      allowNull: false,
      defaultValue: "granted",
    },
    granted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    withdrawn_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    recorded_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    source_type: {
      type: DataTypes.ENUM(
        "onboarding",
        "user_settings",
        "partner_import",
        "admin",
        "system"
      ),
      allowNull: false,
      defaultValue: "onboarding",
    },
    source_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "consent_records",
    underscored: true,
    timestamps: true,
  }
);

module.exports = ConsentRecord;
