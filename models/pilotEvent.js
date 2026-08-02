const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PilotEvent = sequelize.define(
  "PilotEvent",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    event_name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    event_category: {
      type: DataTypes.ENUM(
        "onboarding",
        "consent",
        "property",
        "document",
        "fact",
        "task",
        "feedback",
        "system"
      ),
      allowNull: false,
      defaultValue: "system",
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
    source_type: {
      type: DataTypes.ENUM(
        "partner_onboarding",
        "property_document",
        "property_fact",
        "property_task",
        "feedback",
        "system",
        "manual"
      ),
      allowNull: false,
      defaultValue: "system",
    },
    source_model: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    source_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    consent_scope: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    partner_context_allowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    activity_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    occurred_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "pilot_events",
    underscored: true,
    timestamps: true,
  }
);

module.exports = PilotEvent;
