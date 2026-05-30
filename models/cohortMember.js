const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CohortMember = sequelize.define(
  "CohortMember",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    partner_cohort_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "partner_cohorts",
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
    external_member_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    membership_status: {
      type: DataTypes.ENUM(
        "invited",
        "onboarded",
        "active",
        "withdrawn",
        "removed",
        "completed"
      ),
      allowNull: false,
      defaultValue: "invited",
    },
    source_type: {
      type: DataTypes.ENUM("manual", "import", "partner_api", "system"),
      allowNull: false,
      defaultValue: "manual",
    },
    invited_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "cohort_members",
    underscored: true,
    timestamps: true,
  }
);

module.exports = CohortMember;
