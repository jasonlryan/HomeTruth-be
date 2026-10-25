const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PartnerProgrammeAccess = sequelize.define(
  "PartnerProgrammeAccess",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    partner_id: { type: DataTypes.INTEGER, allowNull: false },
    partner_programme_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    access_role: {
      type: DataTypes.ENUM(
        "sponsor",
        "programme_manager",
        "analyst",
        "privacy_auditor"
      ),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "revoked"),
      allowNull: false,
      defaultValue: "active",
    },
    granted_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
    revoked_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
    granted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: "partner_programme_accesses", underscored: true, timestamps: true }
);

module.exports = PartnerProgrammeAccess;
