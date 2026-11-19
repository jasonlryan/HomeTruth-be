const { DataTypes } = require('sequelize');
module.exports = require('../config/database').define('ApplianceAgentRun', {
  id:{type:DataTypes.INTEGER,primaryKey:true,autoIncrement:true},
  item_id:{type:DataTypes.INTEGER,allowNull:false},user_id:{type:DataTypes.INTEGER,allowNull:false},
  request_key:{type:DataTypes.STRING(36),allowNull:false},status:{type:DataTypes.STRING(30),allowNull:false},
  identity:{type:DataTypes.JSON,allowNull:false},result:{type:DataTypes.JSON,allowNull:true}
},{tableName:'appliance_agent_runs',underscored:true,timestamps:true});
