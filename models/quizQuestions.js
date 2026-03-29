// QuizQuestion.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const QuizQuestion = sequelize.define("quiz_questions", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    question_text: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM,
        values: ['multiple_choice', 'single_choice', 'text', 'rating'],
        allowNull: false,
        defaultValue: 'single_choice'
    }
},);

module.exports = QuizQuestion;