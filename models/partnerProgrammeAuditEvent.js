const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PartnerProgrammeAuditEvent = sequelize.define(
  "PartnerProgrammeAuditEvent",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    partner_programme_id: { type: DataTypes.INTEGER, allowNull: false },
    actor_user_id: { type: DataTypes.INTEGER, allowNull: true },
    event_type: {
      type: DataTypes.ENUM("created", "updated", "status_changed"),
      allowNull: false,
    },
    previous_status: {
      type: DataTypes.ENUM("draft", "active", "paused", "closed"),
      allowNull: true,
    },
    new_status: {
      type: DataTypes.ENUM("draft", "active", "paused", "closed"),
      allowNull: true,
    },
    changes: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "partner_programme_audit_events",
    underscored: true,
    timestamps: true,
  }
);

module.exports = PartnerProgrammeAuditEvent;
