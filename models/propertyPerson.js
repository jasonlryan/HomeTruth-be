const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PropertyPerson = sequelize.define(
  "PropertyPerson",
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
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    relationship_type: {
      type: DataTypes.ENUM(
        "owner",
        "buyer",
        "seller",
        "landlord",
        "tenant",
        "investor",
        "agent",
        "manager",
        "contractor",
        "lender",
        "insurer",
        "viewer",
        "other"
      ),
      allowNull: false,
    },
    relationship_status: {
      type: DataTypes.ENUM(
        "invited",
        "active",
        "ended",
        "revoked",
        "disputed"
      ),
      allowNull: false,
      defaultValue: "active",
    },
    permission_level: {
      type: DataTypes.ENUM("read", "contribute", "manage", "admin"),
      allowNull: false,
      defaultValue: "read",
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    verification_status: {
      type: DataTypes.ENUM(
        "unverified",
        "user_confirmed",
        "evidence_verified",
        "partner_verified",
        "disputed"
      ),
      allowNull: false,
      defaultValue: "unverified",
    },
    source_type: {
      type: DataTypes.ENUM(
        "manual",
        "user_profile",
        "document",
        "partner_api",
        "system"
      ),
      allowNull: false,
      defaultValue: "manual",
    },
    source_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "property_people",
    underscored: true,
    timestamps: true,
  }
);

module.exports = PropertyPerson;
