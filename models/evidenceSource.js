const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const EvidenceSource = sequelize.define(
  "EvidenceSource",
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
    property_document_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "property_documents",
        key: "id",
      },
    },
    user_document_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "userDocuments",
        key: "id",
      },
    },
    source_type: {
      type: DataTypes.ENUM(
        "user_document",
        "system_document",
        "url",
        "manual",
        "partner_api",
        "listing",
        "ai_extraction"
      ),
      allowNull: false,
    },
    source_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    source_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    extraction_method: {
      type: DataTypes.ENUM("manual", "ocr", "ai", "partner_api", "system"),
      allowNull: false,
      defaultValue: "manual",
    },
    extracted_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    page_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    locator: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    confidence: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
    },
  },
  {
    tableName: "evidence_sources",
    underscored: true,
    timestamps: true,
  }
);

module.exports = EvidenceSource;
