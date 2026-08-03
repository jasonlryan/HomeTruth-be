const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PartnerCampaign = sequelize.define(
  "PartnerCampaign",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    partner_programme_id: { type: DataTypes.INTEGER, allowNull: false },
    campaign_key: { type: DataTypes.STRING(120), allowNull: false },
    name: { type: DataTypes.STRING(180), allowNull: false },
    status: {
      type: DataTypes.ENUM("draft", "active", "paused", "closed"),
      allowNull: false,
      defaultValue: "draft",
    },
    invite_route: { type: DataTypes.STRING(255), allowNull: true },
    approved_content_ref: { type: DataTypes.STRING(255), allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    created_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
    updated_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "partner_campaigns", underscored: true, timestamps: true }
);

module.exports = PartnerCampaign;
