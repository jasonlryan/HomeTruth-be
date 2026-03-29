const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");

const UserExtension = sequelize.define("user_extensions", {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    extension_installed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    install_date: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: false
});

module.exports = UserExtension;