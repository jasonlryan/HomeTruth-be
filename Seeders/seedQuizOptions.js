const sequelize = require("../config/database");
const QuizOption = require("../models/quizOption");

const seedQuizOptions = async () => {
  try {
    const count = await QuizOption.count();
    if (count > 0) {
      console.log("Quiz options already exist!");
      return;
    }

    const options = [
      // Question 1
      { question_id: 1, option: 'Parks' },
      { question_id: 1, option: 'Gyms' },
      { question_id: 1, option: 'Public transit' },
      { question_id: 1, option: 'Pets' },
      { question_id: 1, option: 'Balcony' },
      { question_id: 1, option: 'Schools' },

      // Question 2
      { question_id: 2, option: 'Independence / privacy' },
      { question_id: 2, option: 'Starting a family' },
      { question_id: 2, option: 'Relocating' },
      { question_id: 2, option: 'Tired of renting' },
      { question_id: 2, option: 'Downsizing' },
      { question_id: 2, option: 'Investing' },

      // Question 3
      { question_id: 3, option: 'Legal documents' },
      { question_id: 3, option: 'Too many listing sites' },
      { question_id: 3, option: 'Choosing a location' },
      { question_id: 3, option: 'Prioritizing home features' },

      // Question 5
      { question_id: 5, option: 'Visuals (e.g., charts, diagrams)', image: '1' },
      { question_id: 5, option: 'Bullet summaries', image: '2' },
      { question_id: 5, option: 'Narrative guides', image: '3' },
      { question_id: 5, option: 'Interactive Q&A', image: '4' },

      // Question 6
      { question_id: 6, option: 'Not Urgent' },
      { question_id: 6, option: 'Low Priority' },
      { question_id: 6, option: 'Moderate Priority' },
      { question_id: 6, option: 'High Priority' },
      { question_id: 6, option: 'Immediate' },

      // Question 7
      { question_id: 7, option: '50000' },
      { question_id: 7, option: '750000' },

      // Question 8
      { question_id: 8, option: 'Quiet' },
      { question_id: 8, option: 'Family Friendly' },
      { question_id: 8, option: 'Close to transit' },
      { question_id: 8, option: 'eco-conscious' },
      { question_id: 8, option: 'cozy' },
      { question_id: 8, option: 'modern' },
      { question_id: 8, option: 'walkable' },
    ];

    await QuizOption.bulkCreate(options);
    console.log("Quiz options seeded successfully.");
  } catch (error) {
    console.error("Error seeding quiz options:", error);
    throw error;
  }
};
 
module.exports = { seedQuizOptions };
