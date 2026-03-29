const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");

const UserSetting = sequelize.define("user_settings", {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    use_behavioral_personalization: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    use_chat_history: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    opt_out_automated_profiling: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    allow_anonymous_data: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    gdpr_consent: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, );

module.exports = UserSetting;