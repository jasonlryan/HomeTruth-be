const {QuizQuestion,QuizOption,QuizAnswer,User} = require('../../models/index');

const { Op } = require('sequelize');

class QuizAnswerController {
    // Create a new quiz answer
    async createAnswer(req, res) {
        try {    const user_id = req.user.id;

            const {  question_id, option_id, answer } = req.body;

            // Validate required fields
            if (!user_id || !question_id) {
                return res.status(400).json({
                    success: false,
                    message: 'user_id and question_id are required'
                });
            }
           
            

            // Check if question exists and get its type
            const question = await QuizQuestion.findByPk(question_id);
            if (!question) {
                return res.status(400).json({
                    success: false,
                    message: 'Question with the provided ID does not exist'
                });
            }

            let validatedData = {
                user_id,
                question_id
            };

            // Handle different question types
            switch (question.type) {
                case 'single_choice':
                    // For single choice, option_id is required
                    if (!option_id) {
                        return res.status(400).json({
                            success: false,
                            message: 'option_id is required for single_choice questions'
                        });
                    }

                    // Validate that option belongs to this question
                    const singleOption = await QuizOption.findOne({
                        where: { id: option_id, question_id }
                    });

                    if (!singleOption) {
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid option_id for this question'
                        });
                    }

                    validatedData.option_id = option_id;
                    break;

                    case 'multiple_choice':
                        if (!option_id) {
                            return res.status(400).json({
                                success: false,
                                message: 'option_id is required for multiple_choice questions'
                            });
                        }
                    
                        const optionIds = Array.isArray(option_id) ? option_id : [option_id];
                    
                        // Validate all option IDs belong to this question
                        const multipleOptions = await QuizOption.findAll({
                            where: {
                                id: { [Op.in]: optionIds },
                                question_id
                            }
                        });
                    
                        if (multipleOptions.length !== optionIds.length) {
                            return res.status(400).json({
                                success: false,
                                message: 'One or more invalid option_ids for this question'
                            });
                        }
                    
                        // Delete any existing answers for this question by this user (optional: only for multi)
                        await QuizAnswer.destroy({
                            where: { user_id, question_id }
                        });
                    
                        // Create one answer for each selected option_id
                        const createdAnswers = await Promise.all(
                            optionIds.map(optionId => {
                                return QuizAnswer.create({
                                    user_id,
                                    question_id,
                                    option_id: optionId,
                                    answer: null
                                });
                            })
                        );
                    
                        return res.status(201).json({
                            success: true,
                            message: 'Multiple choice answers created successfully',
                            data: createdAnswers
                        });
                        case 'text':
                            if (!answer) {
                                return res.status(400).json({
                                    success: false,
                                    message: 'answer is required for text questions'
                                });
                            }
                        
                            // Ensure answer is stored as an array
                            const answerArray = Array.isArray(answer) ? answer : [answer];
                        
                            validatedData.answer = answerArray;
                            validatedData.option_id = null; // Explicitly set null, or omit this line if DB allows null by default
                            break;
                            case 'rating':
                                if (answer === undefined || answer === null) {
                                    return res.status(400).json({
                                        success: false,
                                        message: 'answer (rating value) is required for rating questions'
                                    });
                                }
                            
                                if (typeof answer !== 'number' || answer < 50000 || answer > 750000) {
                                    return res.status(400).json({
                                        success: false,
                                        message: 'Rating must be a number between 50000 and 750000'
                                    });
                                }
                            
                                validatedData.answer = [answer]; // Store answer as an array
                                validatedData.option_id = null;  // Optional: you can also remove this key entirely
                                break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid question type'
                    });
            }

            // Check if user has already answered this question
            const existingAnswer = await QuizAnswer.findOne({
                where: { user_id, question_id }
            });

            let result;
            if (existingAnswer) {
                // Update existing answer
                result = await existingAnswer.update(validatedData);
                return res.status(200).json({
                    success: true,
                    message: 'Quiz answer updated successfully',
                    data: result
                });
            } else {
                // Create new answer
                result = await QuizAnswer.create(validatedData);
                return res.status(201).json({
                    success: true,
                    message: 'Quiz answer created successfully',
                    data: result
                });
            }

        } catch (error) {
            console.error('Error creating/updating quiz answer:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get all quiz answers
    async getAllAnswers(req, res) {
        try {
            const answers = await QuizAnswer.findAll({
                order: [['id', 'ASC']]
            });

            res.status(200).json({
                success: true,
                message: 'Quiz answers retrieved successfully',
                data: answers,
                count: answers.length
            });
        } catch (error) {
            console.error('Error fetching quiz answers:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get quiz answer by ID
    async getAnswerById(req, res) {
        try {
            const { id } = req.params;

            const answer = await QuizAnswer.findByPk(id);

            if (!answer) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz answer not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Quiz answer retrieved successfully',
                data: answer
            });
        } catch (error) {
            console.error('Error fetching quiz answer:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get answers by user ID
    async getAnswersByUserId(req, res) {
        try {
            const { user_id } = req.params;
    
            const answers = await QuizAnswer.findAll({
                where: { user_id },
                include: [
                    {
                        model: QuizQuestion,
                        attributes: ['id', 'question_text', 'type']
                    },
                    {
                        model: QuizOption,
                        attributes: ['id', 'option', 'image']
                    }
                ],
                order: [['question_id', 'ASC']]
            });
    
            const formattedAnswers = answers.map(answer => ({
                answer_id: answer.id,
                question: {
                    id: answer.quiz_question.id,
                    text: answer.quiz_question.question_text,
                    type: answer.quiz_question.type
                },
                selected_option: answer.quiz_option ? {
                    id: answer.quiz_option.id,
                    text: answer.quiz_option.option,
                    image: answer.quiz_option.image
                } : null,
                raw_answer: answer.answer || null
            }));
    
            res.status(200).json({
                success: true,
                message: 'User quiz answers with questions retrieved successfully',
                count: formattedAnswers.length,
                data: formattedAnswers
            });
    
        } catch (error) {
            console.error('Error fetching user quiz answers:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
    
    async getAnswersWithQuestionsByUserId(req, res) {
    try {
        const { user_id } = req.params;

        const answers = await QuizAnswer.findAll({
            where: { user_id },
            order: [['question_id', 'ASC']],
            include: [
                {
                    model: QuizQuestion,
                    attributes: ['id', 'question', 'image'] // Add more fields as needed
                },
                {
                    model: QuizOption,
                    attributes: ['id', 'option', 'image']
                }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'User answers with questions retrieved successfully',
            data: answers,
            count: answers.length
        });
    } catch (error) {
        console.error('Error fetching user answers with questions:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}


    // Get answers by question ID
    async getAnswersByQuestionId(req, res) {
        try {
            const { question_id } = req.params;

            const answers = await QuizAnswer.findAll({
                where: { question_id },
                order: [['user_id', 'ASC']]
            });

            res.status(200).json({
                success: true,
                message: 'Question answers retrieved successfully',
                data: answers,
                count: answers.length
            });
        } catch (error) {
            console.error('Error fetching question answers:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get specific user's answer for a specific question
    async getUserQuestionAnswer(req, res) {
        try {
            const { user_id, question_id } = req.params;

            const answer = await QuizAnswer.findOne({
                where: { user_id, question_id }
            });

            if (!answer) {
                return res.status(404).json({
                    success: false,
                    message: 'Answer not found for this user and question'
                });
            }

            res.status(200).json({
                success: true,
                message: 'User question answer retrieved successfully',
                data: answer
            });
        } catch (error) {
            console.error('Error fetching user question answer:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Update quiz answer by question_id and user_id
    async updateAnswer(req, res) {
    try {
        const user_id = req.user.id;
        const { question_id, option_id, answer } = req.body;
console.log(user_id,question_id, option_id, answer);

        if (!user_id || !question_id) {
            return res.status(400).json({
                success: false,
                message: 'user_id and question_id are required'
            });
        }

        const question = await QuizQuestion.findByPk(question_id);
        if (!question) {
            return res.status(400).json({
                success: false,
                message: 'Question not found'
            });
        }

        let validatedData = {
            user_id,
            question_id
        };

        switch (question.type) {
            case 'single_choice':
                if (!option_id) {
                    return res.status(400).json({
                        success: false,
                        message: 'option_id is required for single_choice questions'
                    });
                }

                const singleOption = await QuizOption.findOne({
                    where: { id: option_id, question_id }
                });

                if (!singleOption) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid option_id for this question'
                    });
                }

                validatedData.option_id = option_id;
                validatedData.answer = null;
                break;

            case 'multiple_choice':
                if (!option_id || !Array.isArray(option_id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'option_id must be an array for multiple_choice questions'
                    });
                }

                const multipleOptions = await QuizOption.findAll({
                    where: {
                        id: { [Op.in]: option_id },
                        question_id
                    }
                });

                if (multipleOptions.length !== option_id.length) {
                    return res.status(400).json({
                        success: false,
                        message: 'One or more invalid option_ids for this question'
                    });
                }

                // Delete existing answers
                await QuizAnswer.destroy({
                    where: { user_id, question_id }
                });

                // Create new ones
                const createdAnswers = await Promise.all(
                    option_id.map(optId => {
                        return QuizAnswer.create({
                            user_id,
                            question_id,
                            option_id: optId,
                            answer: null
                        });
                    })
                );

                return res.status(200).json({
                    success: true,
                    message: 'Multiple choice answers updated successfully',
                    data: createdAnswers
                });

            case 'text':
                if (!answer) {
                    return res.status(400).json({
                        success: false,
                        message: 'answer is required for text questions'
                    });
                }

                validatedData.answer = Array.isArray(answer) ? answer : [answer];
                validatedData.option_id = null;
                break;

            case 'rating':
                if (answer === undefined || answer === null) {
                    return res.status(400).json({
                        success: false,
                        message: 'answer (rating value) is required'
                    });
                }

                if (typeof answer !== 'number' || answer < 50000 || answer > 750000) {
                    return res.status(400).json({
                        success: false,
                        message: 'Rating must be a number between 50000 and 750000'
                    });
                }

                validatedData.answer = [answer];
                validatedData.option_id = null;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid question type'
                });
        }

        const existingAnswer = await QuizAnswer.findOne({
            where: { user_id, question_id }
        });

        let result;
        if (existingAnswer) {
            result = await existingAnswer.update(validatedData);
        } else {
            result = await QuizAnswer.create(validatedData);
        }

        return res.status(200).json({
            success: true,
            message: 'Quiz answer updated successfully',
            data: result
        });

    } catch (error) {
        console.error('Error updating quiz answer:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
    }
    // Bulk update all answers
    async updateAllAnswers(req, res) {
    try {
      const user_id = req.user.id;
      const { answers } = req.body;
  
      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'answers must be a non-empty array'
        });
      }
  
      const results = [];
  
      for (const item of answers) {
        const { question_id, option_id, answer } = item;
  
        if (!question_id) {
          results.push({ question_id, success: false, message: 'question_id is required' });
          continue;
        }
  
        const question = await QuizQuestion.findByPk(question_id);
        if (!question) {
          results.push({ question_id, success: false, message: 'Question not found' });
          continue;
        }
  
        let validatedData = {
          user_id,
          question_id,
          option_id: null,
          answer: null
        };
  
        switch (question.type) {
          case 'single_choice':
            if (!option_id) {
              results.push({ question_id, success: false, message: 'option_id is required' });
              continue;
            }
  
            const singleOption = await QuizOption.findOne({ where: { id: option_id, question_id } });
            if (!singleOption) {
              results.push({ question_id, success: false, message: 'Invalid option_id' });
              continue;
            }
  
            validatedData.option_id = option_id;
            break;
  
          case 'multiple_choice':
            if (!option_id || !Array.isArray(option_id)) {
              results.push({ question_id, success: false, message: 'option_id must be an array' });
              continue;
            }
  
            const validOptions = await QuizOption.findAll({
              where: {
                id: { [Op.in]: option_id },
                question_id
              }
            });
  
            if (validOptions.length !== option_id.length) {
              results.push({ question_id, success: false, message: 'One or more invalid option_ids' });
              continue;
            }
  
            // Delete existing answers
            await QuizAnswer.destroy({ where: { user_id, question_id } });
  
            // Create new answers
            const createdAnswers = await Promise.all(
              option_id.map(optId => QuizAnswer.create({
                user_id,
                question_id,
                option_id: optId,
                answer: null
              }))
            );
  
            results.push({ question_id, success: true, message: 'Multiple choice answers updated', data: createdAnswers });
            continue;
  
          case 'text':
            if (!answer) {
              results.push({ question_id, success: false, message: 'answer is required for text question' });
              continue;
            }
  
            validatedData.answer = Array.isArray(answer) ? answer : [answer];
            break;
  
          case 'rating':
            if (typeof answer !== 'number' || answer < 50000 || answer > 750000) {
              results.push({ question_id, success: false, message: 'Rating must be a number between 50000 and 750000' });
              continue;
            }
  
            validatedData.answer = [answer];
            break;
  
          default:
            results.push({ question_id, success: false, message: 'Invalid question type' });
            continue;
        }
  
        // Check if an answer exists
        const existingAnswer = await QuizAnswer.findOne({
          where: { user_id, question_id }
        });
  
        let saved;
        if (existingAnswer) {
          saved = await existingAnswer.update(validatedData);
        } else {
          saved = await QuizAnswer.create(validatedData);
        }
  
        results.push({ question_id, success: true, message: 'Answer saved', data: saved });
      }
  
      res.status(200).json({
        success: true,
        message: 'Answers processed',
        results
      });
  
    } catch (error) {
      console.error('Error bulk updating answers:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
    }
  
    // Delete quiz answer
    async deleteAnswer(req, res) {
        try {
            const { id } = req.params;

            const answer = await QuizAnswer.findByPk(id);

            if (!answer) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz answer not found'
                });
            }

            await answer.destroy();

            res.status(200).json({
                success: true,
                message: 'Quiz answer deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting quiz answer:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Delete all answers for a user
    async deleteUserAnswers(req, res) {
        try {
            const { user_id } = req.params;

            const deletedCount = await QuizAnswer.destroy({
                where: { user_id }
            });

            res.status(200).json({
                success: true,
                message: `${deletedCount} quiz answers deleted successfully`,
                deletedCount
            });
        } catch (error) {
            console.error('Error deleting user answers:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get quiz completion status for a user
    async getQuizCompletion(req, res) {
        try {
            const { user_id } = req.params;

            // Get total questions count
            const totalQuestions = await QuizQuestion.count();

            // Get answered questions count for user
            const answeredQuestions = await QuizAnswer.count({
                where: { user_id }
            });

            const completionPercentage = totalQuestions > 0 
                ? Math.round((answeredQuestions / totalQuestions) * 100) 
                : 0;

            res.status(200).json({
                success: true,
                message: 'Quiz completion status retrieved successfully',
                data: {
                    user_id: parseInt(user_id),
                    total_questions: totalQuestions,
                    answered_questions: answeredQuestions,
                    completion_percentage: completionPercentage,
                    is_complete: answeredQuestions >= totalQuestions
                }
            });
        } catch (error) {
            console.error('Error fetching quiz completion:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
}

module.exports = new QuizAnswerController();