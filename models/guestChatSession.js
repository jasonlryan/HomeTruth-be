const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const GuestChatSession = sequelize.define("guest_chat_session", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true,
  },
  user_message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  assistant_reply: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});


module.exports = GuestChatSession;
