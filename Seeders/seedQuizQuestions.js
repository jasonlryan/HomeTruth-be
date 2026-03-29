const sequelize = require("../config/database");
const QuizQuestion = require("../models/quizQuestions");

const seedQuizQuestions = async () => {
  try {
    const count = await QuizQuestion.count();
    if (count > 0) {
      console.log("Quiz questions already exist!");
      return;
    }

    const questions = [
      {
        question_text: 'What lifestyle factors should we prioritize when recommending properties?',
        type: 'multiple_choice',
      },
      {
        question_text: "What's motivating you to find a new home?",
        type: 'multiple_choice',
      },
      {
        question_text: 'What parts of the homebuying process feel overwhelming?',
        type: 'multiple_choice',
      },
      {
        question_text: "What's your biggest fear about homebuying, in your own words?",
        type: 'text',
      },
      {
        question_text: 'How do you prefer to understand new information?',
        type: 'single_choice',
      },
      {
        question_text: 'How quickly are you hoping to buy?',
        type: 'single_choice',
      },
      {
        question_text: 'What is your budget range?',
        type: 'rating',
      },
      {
        question_text: 'Describe your ideal living environment.',
        type: 'multiple_choice',
      },
    ];

    await QuizQuestion.bulkCreate(questions, { returning: true });

    console.log("Quiz questions seeded successfully.");
  } catch (error) {
    console.error("Error seeding quiz questions:", error);
    throw error;
  }
};

module.exports = { seedQuizQuestions };
