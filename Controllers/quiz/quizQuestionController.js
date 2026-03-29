const {QuizQuestion,QuizOption,QuizAnswer,User} = require('../../models/index');



const { Op } = require('sequelize');

const quizQuestionController = {
    // Create a new quiz question
    async createQuestion(req, res) {
        try {
            const { question_text, type } = req.body;

            // Validate required fields
            if (!question_text) {
                return res.status(400).json({
                    success: false,
                    message: 'question_text is required'
                });
            }

            const newQuestion = await QuizQuestion.create({
                question_text,
                type: type || 'single_choice'
            });

            res.status(201).json({
                success: true,
                message: 'Quiz question created successfully',
                data: newQuestion
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error creating quiz question',
                error: error.message
            });
        }
    },

    async getAllQuestions(req, res) {
        try {
            const user_id = req.user.id;
            
            let whereCondition = {};
            
            // If user_id is provided, exclude questions that have been answered by this user
            if (user_id) {
                // Find all question_ids that have been answered by this user
                const answeredQuestionIds = await QuizAnswer.findAll({
                    where: { user_id: user_id },
                    attributes: ['question_id'],
                    raw: true
                });
                
                // Extract the question IDs
                const answeredIds = answeredQuestionIds.map(answer => answer.question_id);
                
                // If there are answered questions, exclude them
                if (answeredIds.length > 0) {
                    whereCondition.id = {
                        [Op.notIn]: answeredIds
                    };
                }
            }
            
            const questions = await QuizQuestion.findAll({
                where: whereCondition,
                order: [['id', 'ASC']],
                include: [{
                    model: QuizOption,
                    attributes: ['id', 'option', 'image'],
                    order: [['id', 'ASC']]
                }]
            });
    
            res.status(200).json({
                success: true,
                message: user_id 
                    ? `Quiz questions for user ${user_id} (excluding answered) retrieved successfully`
                    : 'All quiz questions with options retrieved successfully',
                data: questions,
                count: questions.length
            });
    
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error retrieving quiz questions with options',
                error: error.message
            });
        }
    },
    //*
    async getAllQuestionsWithAnswer(req, res) {
        try {
            const user_id = req.user.id;
    
            // Get all questions with their options
            const questions = await QuizQuestion.findAll({
                order: [['id', 'ASC']],
                include: [{
                    model: QuizOption,
                    attributes: ['id', 'option', 'image'],
                    order: [['id', 'ASC']]
                }]
            });
    
            // Get all user's answers with option data
            const userAnswers = await QuizAnswer.findAll({
                where: { user_id },
                attributes: ['question_id', 'option_id', 'answer'],
                include: [{
                    model: QuizOption,
                    attributes: ['option']
                }],
                raw: true
            });
    
            // Map answers to question_id => array of answers
            const answersMap = {};
            userAnswers.forEach(ans => {
                const questionId = ans.question_id;
                if (!answersMap[questionId]) {
                    answersMap[questionId] = [];
                }
                answersMap[questionId].push({
                    option_id: ans.option_id || null,
                    option_text: ans['quiz_option.option'] || null,
                    answer: ans.answer || null,
                    is_answered: true
                });
            });
    
            // Structure the final response
            const questionsWithAnswers = questions.map(question => {
                const answersForQuestion = answersMap[question.id] || [{
                    option_id: null,
                    option_text: null,
                    answer: null,
                    is_answered: false
                }];
    
                return {
                    id: question.id,
                    question_text: question.question_text,
                    type: question.type,
                    created_at: question.createdAt,
                    updated_at: question.updatedAt,
                    options: question.quiz_options.map(option => ({
                        id: option.id,
                        text: option.option,
                        image: option.image
                    })),
                    total_options: question.quiz_options.length,
                    user_answer: answersForQuestion
                };
            });
    
            res.status(200).json({
                success: true,
                message: 'Quiz questions with user answers retrieved successfully',
                data: questionsWithAnswers,
                count: questionsWithAnswers.length,
                user_id
            });
    
        } catch (error) {
            console.error('Error in getAllQuestionsWithAnswer:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving quiz questions with user answers',
                error: error.message
            });
        }
    },
    // Get a specific question by ID
    async getQuestionById(req, res) {
        try {
            const { id } = req.params;
            const question = await QuizQuestion.findByPk(id);

            if (!question) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz question not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Quiz question retrieved successfully',
                data: question
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error retrieving quiz question',
                error: error.message
            });
        }
    },
   // Get a specific question by ID with its options
   async getQuestionWithOptions(req, res) {
    try {
        const { id } = req.params;
        console.log(id);
        
        
        const question = await QuizQuestion.findByPk(id, {
            include: [{
                model: QuizOption,
                attributes: ['id', 'option', 'image'],
                order: [['id', 'ASC']]
            }]
        });
        // console.log(question);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Quiz question not found'
            });
        }

        // Structure the response nicely
        const structuredData = {
            id: question.id,
            question_text: question.question_text,
            type: question.type,
            created_at: question.createdAt,
            updated_at: question.updatedAt,
            options: question.quiz_options.map(option => ({
                id: option.id,
                text: option.option,
                image: option.image
            })),
            total_options: question.quiz_options.length
        };

        res.status(200).json({
            success: true,
            message: 'Quiz question with options retrieved successfully',
            data: structuredData
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving quiz question with options',
            error: error.message
        });
    }
},

// Get all questions with their options
async getAllQuestionsWithOptions(req, res) {
    try {
      const questions = await QuizQuestion.findAll({
        // include: [{
        //   model: QuizOption,
        // //   attributes: ['id', 'option', 'image'],
        // }],
        // order: [
        //   ['id', 'ASC'],
        //   [QuizOption, 'id', 'ASC'] // Ensures options are also sorted
        // ]
      });
      console.log(questions);
      
  
      const structuredData = questions.map(question => ({
        id: question.id,
        question_text: question.question_text,
        type: question.type,
        created_at: question.createdAt,
        updated_at: question.updatedAt,
        options: question.QuizOptions.map(option => ({
          id: option.id,
          text: option.option,
          image: option.image
        })),
        total_options: question.QuizOptions.length
      }));
  
      res.status(200).json({
        success: true,
        message: 'All quiz questions with options retrieved successfully',
        data: structuredData,
        count: structuredData.length
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving quiz questions with options',
        error: error.message
      });
    }
  }
  
,  
    
   
    // Update a quiz question
    async updateQuestion(req, res) {
        try {
            const { id } = req.params;
            const { question_text, type } = req.body;

            const question = await QuizQuestion.findByPk(id);

            if (!question) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz question not found'
                });
            }

            const updatedQuestion = await question.update({
                question_text: question_text !== undefined ? question_text : question.question_text,
                type: type !== undefined ? type : question.type
            });

            res.status(200).json({
                success: true,
                message: 'Quiz question updated successfully',
                data: updatedQuestion
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error updating quiz question',
                error: error.message
            });
        }
    },

    // Delete a quiz question
    async deleteQuestion(req, res) {
        try {
            const { id } = req.params;
            const question = await QuizQuestion.findByPk(id);

            if (!question) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz question not found'
                });
            }

            await question.destroy();

            res.status(200).json({
                success: true,
                message: 'Quiz question deleted successfully'
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error deleting quiz question',
                error: error.message
            });
        }
    },

    // Get questions by type
    async getQuestionsByType(req, res) {
        try {
            const { type } = req.params;
            
            if (!['multiple_choice', 'single_choice', 'text', 'rating'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid question type'
                });
            }

            const questions = await QuizQuestion.findAll({
                where: { type },
                order: [['id', 'ASC']]
            });

            res.status(200).json({
                success: true,
                message: `Questions of type '${type}' retrieved successfully`,
                data: questions,
                count: questions.length
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error retrieving questions by type',
                error: error.message
            });
        }
    },

  
};

module.exports = quizQuestionController;