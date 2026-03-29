const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const QuizOption = sequelize.define("quiz_options", { // Changed to plural
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    question_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    option: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Legacy field - stores any answer format'
    },
    image: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'URL or path to option image'
    }
}, );


module.exports = QuizOption;