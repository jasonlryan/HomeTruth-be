
const express = require('express');
const router = express.Router();
const auth = require("../Middleware/authMiddleware");
const aiChatBudgetController = require('../Controllers/budgetCalculation/budget_calculation');

// Start a new AI chat session and create budget calculation record
router.post('/start-ai-chat', auth, aiChatBudgetController.startAIBudgetChat);

// Continue AI chat conversation and update database
router.post('/continue-ai-chat', auth, aiChatBudgetController.continueAIBudgetChat);

// Manually update specific field (for when extraction fails)
router.put('/update-field/:budgetCalculationId', auth, aiChatBudgetController.updateBudgetField);

// Manually update specific field (for when extraction fails)
router.put('/update-all/:budgetCalculationId', auth, aiChatBudgetController.updateAllBudgetFields);

// Generate estimate from chat data
router.post('/generate-estimate/:budgetCalculationId', auth, aiChatBudgetController.generateEstimateFromChat);

// Get current budget calculation status
router.get('/status/:budgetCalculationId', auth, aiChatBudgetController.getBudgetChatStatus);
router.get('/all', auth, aiChatBudgetController.getAllBudgetCalculations);
router.get('/allSaved', auth, aiChatBudgetController.getSavedBudgetCalculations);

router.patch('/:budgetCalculationId/save/:name', auth, aiChatBudgetController.markAsSaved);
router.patch('/:budgetCalculationId/name', auth, aiChatBudgetController.updateBudgetCalculationName);

// Clear a specific field to allow re-entry
router.patch('/:budgetCalculationId/clear-field/:field', auth, aiChatBudgetController.clearBudgetField);







module.exports = router;