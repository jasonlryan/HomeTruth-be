const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PartnerProgramme = sequelize.define(
  "PartnerProgramme",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    partner_id: { type: DataTypes.INTEGER, allowNull: false },
    programme_key: { type: DataTypes.STRING(120), allowNull: false },
    name: { type: DataTypes.STRING(180), allowNull: false },
    status: {
      type: DataTypes.ENUM("draft", "active", "paused", "closed"),
      allowNull: false,
      defaultValue: "draft",
    },
    owner_user_id: { type: DataTypes.INTEGER, allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    entitlement: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    invite_mode: {
      type: DataTypes.ENUM("cohort_code", "individual_invite", "both"),
      allowNull: false,
      defaultValue: "cohort_code",
    },
    approved_content_refs: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    created_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
    updated_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
    activated_at: { type: DataTypes.DATE, allowNull: true },
    paused_at: { type: DataTypes.DATE, allowNull: true },
    closed_at: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: "partner_programmes", underscored: true, timestamps: true }
);

module.exports = PartnerProgramme;
