const {
  DataTypes
} = require('sequelize');
const sequelize = require('../config/database');
module.exports = sequelize.define('HomeItemAnswer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  token_hash: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  content: {
    type: DataTypes.JSON,
    allowNull: false
  }
}, {
  tableName: 'home_item_answers',
  underscored: true,
  timestamps: true
});
