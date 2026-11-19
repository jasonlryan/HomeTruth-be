const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('HomeItemEvidence', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  item_id: { type: DataTypes.INTEGER, allowNull: false },
  user_document_id: { type: DataTypes.INTEGER, allowNull: false },
  role: { type: DataTypes.STRING(30), allowNull: false },
  match_status: { type: DataTypes.STRING(30), allowNull: false },
}, { tableName: 'home_item_evidence', timestamps: true, underscored: true });
