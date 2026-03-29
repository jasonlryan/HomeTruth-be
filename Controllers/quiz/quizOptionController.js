const QuizOption = require('../../models/quizOption');
const QuizQuestion = require('../../models/quizQuestions');

class QuizOptionController {
    // Create a new quiz option
    async createOption(req, res) {
        try {
            const { question_id, option, image } = req.body;

            // Validate required fields
            if (!question_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Question ID is required'
                });
            }

            // Validate that question_id exists
            const existingQuestion = await QuizQuestion.findByPk(question_id);
            if (!existingQuestion) {
                return res.status(400).json({
                    success: false,
                    message: 'Question with the provided ID does not exist'
                });
            }

            const newOption = await QuizOption.create({
                question_id,
                option,
                image
            });

            res.status(201).json({
                success: true,
                message: 'Quiz option created successfully',
                data: newOption
            });
        } catch (error) {
            console.error('Error creating quiz option:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get all quiz options
    async getAllOptions(req, res) {
        try {
            const options = await QuizOption.findAll({
                order: [['id', 'ASC']]
            });

            res.status(200).json({
                success: true,
                message: 'Quiz options retrieved successfully',
                data: options,
                count: options.length
            });
        } catch (error) {
            console.error('Error fetching quiz options:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get quiz option by ID
    async getOptionById(req, res) {
        try {
            const { id } = req.params;

            const option = await QuizOption.findByPk(id);

            if (!option) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz option not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Quiz option retrieved successfully',
                data: option
            });
        } catch (error) {
            console.error('Error fetching quiz option:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get options by question ID
    async getOptionsByQuestionId(req, res) {
        try {
            const { question_id } = req.params;

            const options = await QuizOption.findAll({
                where: { question_id },
                order: [['id', 'ASC']]
            });

            res.status(200).json({
                success: true,
                message: 'Quiz options for question retrieved successfully',
                data: options,
                count: options.length
            });
        } catch (error) {
            console.error('Error fetching quiz options by question ID:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    async getAllQuestionsWithOptions(req, res) {
    try {
        const questionsWithOptions = await QuizQuestion.findAll({
            include: [{
                model: QuizOption,
                order: [['id', 'ASC']]
            }],
            order: [['id', 'ASC']]
        });

        const formattedData = questionsWithOptions.map(question => ({
            question: {
                id: question.id,
                question_text: question.question_text,
                type: question.type,
                createdAt: question.createdAt,
                updatedAt: question.updatedAt
            },
            options: question.QuizOptions,
            options_count: question.QuizOptions.length
        }));

        res.status(200).json({
            success: true,
            message: 'All questions with options retrieved successfully',
            data: formattedData,
            count: formattedData.length
        });

    } catch (error) {
        console.error('Error fetching all questions with options:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}
    // Update quiz option
    async updateOption(req, res) {
        try {
            const { id } = req.params;
            const { question_id, option, image } = req.body;

            const existingOption = await QuizOption.findByPk(id);

            if (!existingOption) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz option not found'
                });
            }

            // If question_id is being updated, validate it exists
            if (question_id && question_id !== existingOption.question_id) {
                const existingQuestion = await QuizQuestion.findByPk(question_id);
                if (!existingQuestion) {
                    return res.status(400).json({
                        success: false,
                        message: 'Question with the provided ID does not exist'
                    });
                }
            }

            const updatedOption = await existingOption.update({
                question_id: question_id !== undefined ? question_id : existingOption.question_id,
                option: option !== undefined ? option : existingOption.option,
                image: image !== undefined ? image : existingOption.image
            });

            res.status(200).json({
                success: true,
                message: 'Quiz option updated successfully',
                data: updatedOption
            });
        } catch (error) {
            console.error('Error updating quiz option:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Delete quiz option
    async deleteOption(req, res) {
        try {
            const { id } = req.params;

            const option = await QuizOption.findByPk(id);

            if (!option) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz option not found'
                });
            }

            await option.destroy();

            res.status(200).json({
                success: true,
                message: 'Quiz option deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting quiz option:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Delete all options for a specific question
    async deleteOptionsByQuestionId(req, res) {
        try {
            const { question_id } = req.params;

            const deletedCount = await QuizOption.destroy({
                where: { question_id }
            });

            res.status(200).json({
                success: true,
                message: `${deletedCount} quiz options deleted successfully`,
                deletedCount
            });
        } catch (error) {
            console.error('Error deleting quiz options by question ID:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Bulk create options for a question
    async bulkCreateOptions(req, res) {
        try {
            const { question_id, options } = req.body;

            // Validate required fields
            if (!question_id || !Array.isArray(options) || options.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Question ID and options array are required'
                });
            }

            // Validate that question_id exists
            const existingQuestion = await QuizQuestion.findByPk(question_id);
            if (!existingQuestion) {
                return res.status(400).json({
                    success: false,
                    message: 'Question with the provided ID does not exist'
                });
            }

            // Add question_id to each option
            const optionsWithQuestionId = options.map(opt => ({
                question_id,
                option: opt.option,
                image: opt.image || null
            }));

            const createdOptions = await QuizOption.bulkCreate(optionsWithQuestionId);

            res.status(201).json({
                success: true,
                message: 'Quiz options created successfully',
                data: createdOptions,
                count: createdOptions.length
            });
        } catch (error) {
            console.error('Error bulk creating quiz options:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
}

module.exports = new QuizOptionController();