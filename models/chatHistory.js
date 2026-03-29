const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ChatHistory = sequelize.define('chat_history', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  conversation_id: {
    type: DataTypes.STRING,
    allowNull: true, // Allow null for backward compatibility
    index: true // Add index for faster queries
  },
  userMessage: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  assistantReply: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  is_saved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    index: true // Add index for faster queries on saved conversations
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
});


module.exports = ChatHistory;