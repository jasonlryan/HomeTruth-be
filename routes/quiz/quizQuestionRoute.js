// routes/quizQuestionRoutes.js
const express = require('express');
const router = express.Router();
const quizQuestionController = require('../../Controllers/quiz/quizQuestionController');
const auth = require("../../Middleware/authMiddleware");




// @desc    Create a new quiz question
router.post('/', quizQuestionController.createQuestion);


// @desc    Get all quiz questions
router.get('/',auth, quizQuestionController.getAllQuestions);
router.get('/withAnswer',auth, quizQuestionController.getAllQuestionsWithAnswer);



// @desc    Get a specific quiz question by ID
router.get('/:id', quizQuestionController.getQuestionById);
router.get('/withOption/:id', quizQuestionController.getQuestionWithOptions);
router.get('/allWithOption', quizQuestionController.getAllQuestionsWithOptions);




// @desc    Update a quiz question
router.put('/:id', quizQuestionController.updateQuestion);


// @desc    Delete a quiz question
router.delete('/:id', quizQuestionController.deleteQuestion);


// @desc    Get questions by type (multiple_choice, single_choice, text, rating)
router.get('/type/:type', quizQuestionController.getQuestionsByType);

module.exports = router;