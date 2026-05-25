const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PropertyDocument = sequelize.define(
  "PropertyDocument",
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
    user_document_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "userDocuments",
        key: "id",
      },
    },
    linked_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    document_role: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    relevance: {
      type: DataTypes.ENUM(
        "primary",
        "evidence",
        "supporting",
        "reference",
        "other"
      ),
      allowNull: false,
      defaultValue: "supporting",
    },
    effective_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "property_documents",
    underscored: true,
    timestamps: true,
  }
);

module.exports = PropertyDocument;
