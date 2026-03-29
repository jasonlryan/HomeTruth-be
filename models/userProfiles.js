const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");


const UserProfile = sequelize.define("user_profiles", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        startWith: 1

    },
    
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    preferences: {
        type: DataTypes.JSON,
        allowNull: true
    },
    onboarding_completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, );

module.exports = UserProfile;

