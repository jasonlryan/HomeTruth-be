const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PropertyTask = sequelize.define(
  "PropertyTask",
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
    assigned_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    task_type: {
      type: DataTypes.ENUM(
        "service_due",
        "seasonal_check",
        "document_expiry",
        "missing_baseline",
        "known_issue_follow_up",
        "evidence_improvement"
      ),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    recommended_action: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    priority: {
      type: DataTypes.ENUM("low", "medium", "high"),
      allowNull: false,
      defaultValue: "medium",
    },
    status: {
      type: DataTypes.ENUM("open", "completed", "dismissed", "not_relevant"),
      allowNull: false,
      defaultValue: "open",
    },
    source_type: {
      type: DataTypes.ENUM(
        "rule",
        "property",
        "property_fact",
        "property_document",
        "evidence_source",
        "system",
        "manual"
      ),
      allowNull: false,
      defaultValue: "rule",
    },
    source_model: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    source_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    generation_key: {
      type: DataTypes.STRING(191),
      allowNull: true,
      unique: true,
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    generated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    dismissed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    not_relevant_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status_updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status_updated_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "property_tasks",
    underscored: true,
    timestamps: true,
  }
);

module.exports = PropertyTask;
