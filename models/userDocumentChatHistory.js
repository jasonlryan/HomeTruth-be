const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");
const UserDocument = require("./userDocument");

const UserDocumentChatHistory = sequelize.define("user_document_chat_history", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: "id",
        },
    },
    document_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: UserDocument,
            key: "id",
        },
    },
    conversation_id: {
        type: DataTypes.STRING,
        allowNull: false,
        index: true
    },
    user_message: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    assistant_reply: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    has_context: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_saved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        index: true
    },
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = UserDocumentChatHistory;
