const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");

const Subscription = sequelize.define("subscriptions", {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    plan: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: false
});

module.exports = Subscription;