const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const QuizAnswer = sequelize.define("quiz_answers", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        startWith: 1

    },
    user_id: {
        type: DataTypes.INTEGER,
    allowNull: false,
    },
    question_id: {
        type: DataTypes.INTEGER,
    allowNull: false,
    },
    option_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    answer: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Legacy field - stores any answer format'
    }
}, );

module.exports = QuizAnswer;