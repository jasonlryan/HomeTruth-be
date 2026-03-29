// routes/quizAnswerRoutes.js
const express = require('express');
const router = express.Router();
const quizAnswerController = require('../../Controllers/quiz/quizAnswerController');
const auth = require("../../Middleware/authMiddleware");

// Create or update quiz answer
router.post('/',auth, quizAnswerController.createAnswer);

// Get all quiz answers
router.get('/', quizAnswerController.getAllAnswers);

// Get quiz answer by ID
router.get('/:id', quizAnswerController.getAnswerById);

// Get all answers by user ID
router.get('/user/:user_id', quizAnswerController.getAnswersByUserId);

// Get all answers by question ID
router.get('/question/:question_id', quizAnswerController.getAnswersByQuestionId);

// Get specific user's answer for a specific question
router.get('/user/:user_id/question/:question_id', quizAnswerController.getUserQuestionAnswer);

// Get quiz completion status for a user
router.get('/user/:user_id/completion', quizAnswerController.getQuizCompletion);

// Update quiz answer by ID
router.put('/',auth, quizAnswerController.updateAnswer);
// Update quiz answer by ID
router.put('/update-All',auth, quizAnswerController.updateAllAnswers);
// router.put('/question/:question_id', quizAnswerController.updateAnswerByQuestion);


// Delete quiz answer by ID
router.delete('/:id', quizAnswerController.deleteAnswer);

// Delete all answers for a user
router.delete('/user/:user_id', quizAnswerController.deleteUserAnswers);

module.exports = router;