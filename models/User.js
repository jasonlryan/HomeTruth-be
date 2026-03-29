const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");


const User = sequelize.define("users", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        // startWith: 1

    },
    first_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    last_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        // unique: true,
    },
    password: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM("user", "admin", "pro"),
        defaultValue: "user",
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    home_address: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
}, {

    hooks: {
        beforeSave: async (user) => {
            if (user.changed("password")) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    }
});
    module.exports = User;
    