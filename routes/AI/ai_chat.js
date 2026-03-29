const express = require('express');
const chatController = require('../../Controllers/AI/ai_chat');
const router = express.Router();
const auth = require("../../Middleware/authMiddleware");
const { anonymousChatLimiter, authenticatedChatLimiter } = require("../../Middleware/rateLimit");

// POST /chat - Handle authenticated chat messages with conversation flow (max 5 follow-ups)
router.post('/chat', auth, authenticatedChatLimiter, chatController.handleChat);

// POST /anonymous - Handle anonymous chat messages (max 5 messages per session)
router.post('/anonymous', anonymousChatLimiter, chatController.handleAnonymousChat);

// POST /claim-guest-session - Claim guest chat session after login (auth required)
router.post('/claim-guest-session', auth, chatController.claimGuestSession);

// PUT /toggle-saved - Toggle save/unsave status of a conversation
router.put('/toggle-saved', auth, chatController.toggleConversationSaved);

// GET /history - Get user's chat history (with optional conversation filtering and saved filter)
router.get('/history', auth, chatController.getUserChatHistory);

// GET /conversations - Get list of user's conversations with status (with optional saved filter)
router.get('/conversations', auth, chatController.getConversationList);

// GET /conversation/:conversationId/status - Get conversation status and remaining questions
router.get('/conversation/:conversationId/status', auth, chatController.getConversationStatus);

// DELETE /conversation/:conversationId - Delete a specific conversation
router.delete('/conversation/:conversationId', auth, chatController.deleteConversation);

module.exports = router; 