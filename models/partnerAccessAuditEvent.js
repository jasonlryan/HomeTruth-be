const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PartnerAccessAuditEvent = sequelize.define(
  "PartnerAccessAuditEvent",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    partner_id: { type: DataTypes.INTEGER, allowNull: false },
    partner_programme_id: { type: DataTypes.INTEGER, allowNull: false },
    partner_programme_access_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_user_id: { type: DataTypes.INTEGER, allowNull: true },
    subject_user_id: { type: DataTypes.INTEGER, allowNull: true },
    event_type: { type: DataTypes.STRING(80), allowNull: false },
    action: { type: DataTypes.STRING(80), allowNull: false },
    resource_type: { type: DataTypes.STRING(80), allowNull: false },
    outcome: { type: DataTypes.ENUM("allowed", "denied"), allowNull: false },
    reason_code: { type: DataTypes.STRING(120), allowNull: true },
    details: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: "partner_access_audit_events", underscored: true, timestamps: true }
);

module.exports = PartnerAccessAuditEvent;
