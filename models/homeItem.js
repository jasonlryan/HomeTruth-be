const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('HomeItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  property_id: { type: DataTypes.INTEGER, allowNull: false },
  created_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  request_key: { type: DataTypes.STRING(36), allowNull: false },
  record: { type: DataTypes.JSON, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'home_items', timestamps: true, underscored: true });
