const express = require('express');
const { UserDocumentController, upload } = require('../Controllers/userDocumentController');
const UserDocumentChatController = require('../Controllers/userDocumentChatController');
const authMiddleware = require('../Middleware/authMiddleware');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Document upload routes
router.post('/upload', upload.array('documents', 10), UserDocumentController.uploadDocuments);

// Document management routes
router.get('/', UserDocumentController.getUserDocuments);
router.get('/stats', UserDocumentController.getDocumentStats);
router.get('/:id', UserDocumentController.getDocumentById);
router.get('/:id/preview', UserDocumentController.getDocumentPreview);
router.put('/:id', UserDocumentController.updateDocument);
router.put('/:id/name', UserDocumentController.updateDocumentName);
router.delete('/:id', UserDocumentController.deleteDocument);

// Document search
router.post('/search', UserDocumentController.searchDocuments);

// Document chat routes
router.post('/:id/chat', UserDocumentChatController.chatWithDocument);
router.get('/:id/chat-history', UserDocumentChatController.getDocumentChatHistory);
router.get('/:id/chats', UserDocumentChatController.getDocumentChats);
router.get('/:id/summary', UserDocumentChatController.getDocumentSummary);
router.get('/:id/suggested-questions', UserDocumentChatController.getSuggestedQuestions);
router.get('/:id/insights', UserDocumentChatController.getDocumentInsights);

module.exports = router;
