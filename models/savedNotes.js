const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SavedNote = sequelize.define("saved_notes", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        index: true // Add index for faster queries
    },
    chat_history_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        index: true // Reference to the chat history record
    },
    title: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    user_message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    assistant_reply: {
        type: DataTypes.TEXT,
        allowNull: false
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
}, {
    timestamps: true // Enable automatic timestamp management
});

module.exports = SavedNote;