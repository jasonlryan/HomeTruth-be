const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PropertyTaskStatusEvent = sequelize.define(
  "PropertyTaskStatusEvent",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    property_task_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "property_tasks",
        key: "id",
      },
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
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    from_status: {
      type: DataTypes.ENUM("open", "completed", "dismissed", "not_relevant"),
      allowNull: true,
    },
    to_status: {
      type: DataTypes.ENUM("open", "completed", "dismissed", "not_relevant"),
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "property_task_status_events",
    underscored: true,
    timestamps: true,
  }
);

module.exports = PropertyTaskStatusEvent;
