const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PropertyFact = sequelize.define(
  "PropertyFact",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    property_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "properties",
        key: "id",
      },
    },
    evidence_source_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "evidence_sources",
        key: "id",
      },
    },
    fact_namespace: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    fact_type: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    value_json: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    display_value: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    valid_from: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    valid_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    observed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_current: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    confidence: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
    },
    verification_status: {
      type: DataTypes.ENUM(
        "suggested",
        "user_confirmed",
        "evidence_verified",
        "partner_verified",
        "disputed",
        "expired"
      ),
      allowNull: false,
      defaultValue: "suggested",
    },
    created_from: {
      type: DataTypes.ENUM("manual", "ocr", "ai", "partner_api", "system"),
      allowNull: false,
      defaultValue: "manual",
    },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    tableName: "property_facts",
    underscored: true,
    timestamps: true,
  }
);

module.exports = PropertyFact;
