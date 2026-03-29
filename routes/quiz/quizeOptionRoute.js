// routes/quizOptionRoutes.js
const express = require('express');
const router = express.Router();
const QuizOptionController = require('../../Controllers/quiz/quizOptionController');


// @desc    Create a new quiz option
router.post('/', QuizOptionController.createOption);


// @desc    Bulk create quiz options for a question
router.post('/bulk', QuizOptionController.bulkCreateOptions);


// @desc    Get all quiz options
router.get('/', QuizOptionController.getAllOptions);


// @desc    Get a specific quiz option by ID
router.get('/:id', QuizOptionController.getOptionById);


// @desc    Get all options for a specific question
router.get('/question/:question_id', QuizOptionController.getOptionsByQuestionId);
// router.get('/question_option/:question_id', QuizOptionController.getAllQuestionsWithOptions);




// @desc    Update a quiz option
router.put('/:id', QuizOptionController.updateOption);


// @desc    Delete a quiz option
router.delete('/:id', QuizOptionController.deleteOption);


// @desc    Delete all options for a specific question
router.delete('/question/:question_id', QuizOptionController.deleteOptionsByQuestionId);

module.exports = router;