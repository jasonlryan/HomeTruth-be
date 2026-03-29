const express = require('express');
const router = express.Router();
const { documentController, upload } = require('../Controllers/documentController');
const auth = require('../Middleware/authMiddleware');
const checkRole = require('../Middleware/checkRole');

// Upload documents (multiple files) - Admin only
router.post(
  '/upload',
  auth,
  checkRole(['admin']), // Only admins can upload documents to knowledge base
  upload.array('documents', 20), // Allow up to 20 files
  documentController.uploadDocuments
);

// Get user's documents
router.get('/documents', auth, documentController.getUserDocuments);

// Get specific document info
router.get('/documents/:documentId', auth, documentController.getDocumentInfo);

// Preview document content
router.get('/documents/:documentId/preview', auth, documentController.previewDocument);

// Delete a document
router.delete('/documents/:documentId', auth, documentController.deleteDocument);

// Add knowledge to knowledge base (URL, file upload, or manual entry) - Admin only
router.post(
  '/knowledge',
  auth,
  checkRole(['admin']), // Only admins can add to knowledge base
  upload.single('document'), // Optional file upload
  documentController.addKnowledge
);

// Suggest metadata using AI - Admin only
router.post(
  '/knowledge/suggest-metadata',
  auth,
  checkRole(['admin']), // Only admins can use AI suggestions
  documentController.suggestMetadata
);

// Search knowledge base - Admin only
router.post(
  '/knowledge/search',
  auth,
  checkRole(['admin']),
  documentController.searchKnowledgeBase
);

// Bulk upload documents - Admin only
router.post(
  '/knowledge/bulk-upload',
  auth,
  checkRole(['admin']),
  upload.array('documents', 50), // Allow up to 50 files
  documentController.bulkUpload
);

// Get knowledge base statistics - Admin only
router.get(
  '/knowledge/stats',
  auth,
  checkRole(['admin']),
  documentController.getKnowledgeBaseStats
);

// Export knowledge base data - Admin only
router.get(
  '/knowledge/export',
  auth,
  checkRole(['admin']),
  documentController.exportKnowledgeBase
);

module.exports = router;
