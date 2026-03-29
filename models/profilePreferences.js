const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProfilePreferences = sequelize.define("profile_preferences", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true  // Ensure one preference per user
    },
    communication_tone: {
        type: DataTypes.ENUM('formal', 'friendly', 'encouraging'),
        allowNull: true
    },
    communication_style: {
        type: DataTypes.ENUM('bullet_points', 'narrative_summary', 'visual_aids'),
        allowNull: true
    },
    behavior: {
        type: DataTypes.ENUM('follow_ups', 'link_notes', 'checklist'),
        allowNull: true
    },
    use_profile_personalization: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
});


module.exports = ProfilePreferences;