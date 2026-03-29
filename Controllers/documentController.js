const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Document } = require('../models/index');
const DocumentProcessor = require('../utils/documentProcessor');
const TextSplitter = require('../utils/textSplitter');
const VectorStore = require('../services/vectorStore');
const UrlScraper = require('../utils/urlScraper');
const MetadataSuggestionService = require('../services/metadataSuggestionService');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'temp-images';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const fileExt = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Supported types: PDF, DOCX, TXT'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

const documentController = {
  // Upload single or multiple documents
  async uploadDocuments(req, res) {
    try {
      const user_id = req.user?.id;
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const results = [];
      const errors = [];

      for (const file of req.files) {
        try {
          const documentId = uuidv4();
          const filePath = file.path;
          const filename = file.originalname;
          const fileExt = path.extname(filename).toLowerCase();

          // Process the document
          const text = await DocumentProcessor.processFile(filePath, filename);
          const cleanedText = DocumentProcessor.cleanText(text);
          
          // Split into chunks
          const chunks = TextSplitter.splitBySentences(cleanedText, 500);
          
          // Create document record
          const document = await Document.create({
            sessionId: documentId,
            filename: file.filename,
            originalName: filename,
            fileType: fileExt,
            fileSize: file.size,
            textContent: cleanedText,
            chunksCount: chunks.length,
            processedAt: new Date()
          });

          // Store chunks in vector database
          const metadata = {
            document_id: documentId,
            filename: filename,
            user_id: parseInt(user_id),
            upload_date: new Date().toISOString(),
            file_type: fileExt,
            entry_method: 'file_upload'
          };

          const storedChunks = await VectorStore.storeDocuments(chunks, metadata);
          
          // Update document as processed
          await document.update({
            chunksCount: storedChunks
          });

          results.push({
            id: document.id,
            document_id: documentId,
            filename: filename,
            file_type: fileExt,
            file_size: file.size,
            chunks_created: storedChunks,
            text_length: cleanedText.length
          });

          // Clean up temp file
          fs.unlinkSync(filePath);

        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          errors.push({
            filename: file.originalname,
            error: fileError.message
          });
          
          // Clean up temp file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: `Successfully processed ${results.length} document(s)`,
        data: {
          processed: results,
          errors: errors,
          total_processed: results.length,
          total_errors: errors.length
        }
      });

    } catch (error) {
      console.error('Document upload error:', error);
      
      // Clean up any remaining temp files
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error uploading documents',
        error: error.message
      });
    }
  },

  // Get all documents (system-wide) - Document Library
  async getUserDocuments(req, res) {
    try {
      const user_id = req.user?.id;
      const { page = 1, limit = 10, category, entryMethod, search } = req.query;

      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const offset = (page - 1) * limit;

      // Build where clause
      const where = {};
      if (category) {
        where.category = category;
      }
      if (entryMethod) {
        where.entryMethod = entryMethod;
      }
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { filename: { [Op.like]: `%${search}%` } },
          { originalName: { [Op.like]: `%${search}%` } }
        ];
      }

      const { count, rows: documents } = await Document.findAndCountAll({
        where: where,
        order: [['processedAt', 'DESC']],
        limit: parseInt(limit),
        offset: offset,
        attributes: ['id', 'sessionId', 'title', 'filename', 'originalName', 'fileType', 'fileSize', 'chunksCount', 'category', 'priority', 'source', 'tags', 'entryMethod', 'url', 'processedAt', 'createdAt', 'documentId']
      });

      // Format documents for UI display
      const formattedDocuments = documents.map(doc => {
        // Extract domain from URL
        let sourceDomain = '';
        if (doc.url) {
          try {
            const urlObj = new URL(doc.url);
            sourceDomain = urlObj.hostname.replace('www.', '');
          } catch {
            sourceDomain = doc.source || '';
          }
        } else if (doc.source) {
          sourceDomain = doc.source;
        }

        // Format file type (e.g., "text/html", "application/pdf")
        const fileTypeMap = {
          '.pdf': 'application/pdf',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.doc': 'application/msword',
          '.txt': 'text/plain',
          '.html': 'text/html',
          '.htm': 'text/html'
        };
        const mimeType = fileTypeMap[doc.fileType?.toLowerCase()] || doc.fileType || 'text/plain';

        // Format date/time
        const formattedDate = doc.processedAt 
          ? new Date(doc.processedAt).toLocaleString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            })
          : null;

        // Generate document hash (using sessionId or create hash from id)
        const crypto = require('crypto');
        const documentHash = doc.sessionId 
          ? crypto.createHash('sha256').update(doc.sessionId + doc.id.toString()).digest('hex')
          : crypto.createHash('sha256').update(doc.id.toString()).digest('hex');

        return {
          id: doc.id,
          document_hash: documentHash,
          session_id: doc.sessionId,
          document_id: doc.documentId,
          title: doc.title || doc.originalName || 'Untitled',
          chunks_count: doc.chunksCount || 0,
          url: doc.url || null,
          source_url: sourceDomain,
          source: doc.source || null,
          file_type: mimeType,
          file_extension: doc.fileType || '',
          file_size: doc.fileSize || 0,
          category: doc.category || null,
          priority: doc.priority || 'Normal',
          tags: Array.isArray(doc.tags) ? doc.tags : (doc.tags ? [doc.tags] : []),
          entry_method: doc.entryMethod || 'unknown',
          processed_at: formattedDate,
          processed_at_raw: doc.processedAt,
          created_at: doc.createdAt,
          has_url: !!doc.url,
          metadata: {
            filename: doc.filename,
            original_name: doc.originalName
          }
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          documents: formattedDocuments,
          total_count: count,
          current_page: parseInt(page),
          total_pages: Math.ceil(count / limit),
          has_more: offset + documents.length < count,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            total_pages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      console.error('Error fetching user documents:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching documents',
        error: error.message
      });
    }
  },

  // Delete a document
  async deleteDocument(req, res) {
    try {
      const user_id = req.user?.id;
      const { documentId } = req.params;

      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!documentId) {
        return res.status(400).json({
          success: false,
          message: 'Document ID is required'
        });
      }

      // Find document by ID (can be database ID or try sessionId)
      let document = await Document.findOne({
        where: {
          id: documentId
        }
      });

      // If not found by ID, try sessionId
      if (!document) {
        document = await Document.findOne({
          where: {
            sessionId: documentId
          }
        });
      }

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      // Delete from vector store using sessionId (which is stored as document_id in vector store)
      if (document.sessionId) {
        try {
          await VectorStore.deleteByDocument(document.sessionId);
        } catch (vectorError) {
          console.error('Error deleting from vector store:', vectorError);
          // Continue with database deletion even if vector deletion fails
          // The error might be because vector store is unavailable or document doesn't exist there
        }
      }

      // Delete from database
      await document.destroy();

      return res.status(200).json({
        success: true,
        message: 'Document deleted successfully',
        data: {
          id: document.id,
          session_id: document.sessionId
        }
      });

    } catch (error) {
      console.error('Error deleting document:', error);
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Unknown error';
      let statusCode = 500;
      
      if (error.message && error.message.includes('Bad Request')) {
        statusCode = 400;
        errorMessage = 'Invalid request. Please check the document ID.';
      }

      return res.status(statusCode).json({
        success: false,
        message: 'Error deleting document',
        error: errorMessage
      });
    }
  },

  // Get document info
  async getDocumentInfo(req, res) {
    try {
      const user_id = req.user?.id;
      const { documentId } = req.params;

      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const document = await Document.findOne({
        where: {
          id: documentId
        }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      // Format document similar to library format
      let sourceDomain = '';
      if (document.url) {
        try {
          const urlObj = new URL(document.url);
          sourceDomain = urlObj.hostname.replace('www.', '');
        } catch {
          sourceDomain = document.source || '';
        }
      } else if (document.source) {
        sourceDomain = document.source;
      }

      const crypto = require('crypto');
      const documentHash = document.sessionId 
        ? crypto.createHash('sha256').update(document.sessionId + document.id.toString()).digest('hex')
        : crypto.createHash('sha256').update(document.id.toString()).digest('hex');

      const formattedDate = document.processedAt 
        ? new Date(document.processedAt).toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          })
        : null;

      return res.status(200).json({
        success: true,
        data: {
          ...document.toJSON(),
          document_hash: documentHash,
          source_url: sourceDomain,
          processed_at_formatted: formattedDate
        }
      });

    } catch (error) {
      console.error('Error fetching document info:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching document info',
        error: error.message
      });
    }
  },

  // Preview document content
  async previewDocument(req, res) {
    try {
      const user_id = req.user?.id;
      const { documentId } = req.params;
      const { preview_length = 500 } = req.query;

      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const document = await Document.findOne({
        where: {
          id: documentId
        }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      // Get preview of text content
      const textContent = document.textContent || '';
      const previewText = textContent.length > parseInt(preview_length)
        ? textContent.substring(0, parseInt(preview_length)) + '...'
        : textContent;

      // Extract domain from URL
      let sourceDomain = '';
      if (document.url) {
        try {
          const urlObj = new URL(document.url);
          sourceDomain = urlObj.hostname.replace('www.', '');
        } catch {
          sourceDomain = document.source || '';
        }
      } else if (document.source) {
        sourceDomain = document.source;
      }

      const crypto = require('crypto');
      const documentHash = document.sessionId 
        ? crypto.createHash('sha256').update(document.sessionId + document.id.toString()).digest('hex')
        : crypto.createHash('sha256').update(document.id.toString()).digest('hex');

      return res.status(200).json({
        success: true,
        data: {
          id: document.id,
          document_hash: documentHash,
          title: document.title || document.originalName || 'Untitled',
          preview: previewText,
          full_content_length: textContent.length,
          preview_length: parseInt(preview_length),
          has_more_content: textContent.length > parseInt(preview_length),
          chunks_count: document.chunksCount || 0,
          url: document.url || null,
          source_url: sourceDomain,
          file_type: document.fileType || '',
          category: document.category || null,
          tags: Array.isArray(document.tags) ? document.tags : (document.tags ? [document.tags] : []),
          processed_at: document.processedAt,
          metadata: {
            filename: document.filename,
            original_name: document.originalName,
            entry_method: document.entryMethod,
            priority: document.priority
          }
        }
      });

    } catch (error) {
      console.error('Error fetching document preview:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching document preview',
        error: error.message
      });
    }
  },

  // Add knowledge to knowledge base (supports URL, file upload, or manual entry)
  async addKnowledge(req, res) {
    try {
      const user_id = req.user?.id;
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const {
        url,
        title,
        content,
        category,
        documentId,
        priority = 'Normal',
        source,
        tags = []
      } = req.body;

      let documentTitle = title;
      let documentContent = content;
      let entryMethod = 'manual_entry';
      let documentUrl = null;

      // Determine entry method and extract content
      if (url) {
        // URL scraping
        try {
          const scraped = await UrlScraper.scrapeUrl(url);
          documentTitle = documentTitle || scraped.title;
          documentContent = scraped.content;
          documentUrl = scraped.url;
          entryMethod = 'url_scrape';
        } catch (scrapeError) {
          return res.status(400).json({
            success: false,
            message: `Failed to scrape URL: ${scrapeError.message}`
          });
        }
      } else if (req.file) {
        // File upload (using upload.single)
        const file = req.file;
        const filePath = file.path;
        const filename = file.originalname;
        const fileExt = path.extname(filename).toLowerCase();
        
        // Store file info before processing
        const uploadFileInfo = {
          originalname: filename,
          extension: fileExt,
          size: file.size
        };
        
        try {
          const text = await DocumentProcessor.processFile(filePath, filename);
          documentContent = DocumentProcessor.cleanText(text);
          documentTitle = documentTitle || filename.replace(/\.[^/.]+$/, ''); // Use filename without extension
          entryMethod = 'file_upload';
          
          // Clean up temp file after processing
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          // Store file extension for later use
          req.uploadFileInfo = uploadFileInfo;
        } catch (fileError) {
          // Clean up temp file
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          return res.status(400).json({
            success: false,
            message: `Failed to process file: ${fileError.message}`
          });
        }
      } else if (!content) {
        // No content provided
        return res.status(400).json({
          success: false,
          message: 'Either URL, file upload, or content must be provided'
        });
      }

      // Validate that we have content
      if (!documentContent || documentContent.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Document content cannot be empty'
        });
      }

      // Validate title
      if (!documentTitle || documentTitle.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Document title is required'
        });
      }

      // Validate priority
      const validPriorities = ['Low', 'Normal', 'High', 'Critical'];
      const finalPriority = validPriorities.includes(priority) ? priority : 'Normal';

      // Ensure tags is an array - handle both JSON string and array from form-data
      let finalTags = [];
      if (tags) {
        if (Array.isArray(tags)) {
          finalTags = tags;
        } else if (typeof tags === 'string') {
          try {
            // Try parsing as JSON array string
            const parsed = JSON.parse(tags);
            finalTags = Array.isArray(parsed) ? parsed : [tags];
          } catch {
            // If not JSON, treat as single tag string
            finalTags = [tags];
          }
        } else {
          finalTags = [tags];
        }
      }

      // Generate document ID if not provided
      const finalDocumentId = documentId || uuidv4();

      // Process the document
      const cleanedText = DocumentProcessor.cleanText(documentContent);
      
      // Split into chunks
      const chunks = TextSplitter.splitBySentences(cleanedText, 500);
      
      // Get file extension from stored info or default
      const fileExtension = entryMethod === 'file_upload' 
        ? (req.uploadFileInfo?.extension || '.txt')
        : '.txt';

      // Create document record
      const documentId_uuid = uuidv4();
      const document = await Document.create({
        sessionId: documentId_uuid,
        filename: entryMethod === 'file_upload' 
          ? (req.uploadFileInfo?.originalname || documentTitle.substring(0, 255))
          : documentTitle.substring(0, 255),
        originalName: entryMethod === 'file_upload'
          ? (req.uploadFileInfo?.originalname || documentTitle.substring(0, 255))
          : documentTitle.substring(0, 255),
        fileType: fileExtension,
        fileSize: cleanedText.length,
        textContent: cleanedText,
        chunksCount: chunks.length,
        processedAt: new Date(),
        title: documentTitle,
        category: category || null,
        documentId: finalDocumentId,
        priority: finalPriority,
        source: source || null,
        tags: finalTags,
        url: documentUrl,
        entryMethod: entryMethod
      });

      // Store chunks in vector database
      const metadata = {
        document_id: documentId_uuid,
        filename: documentTitle,
        user_id: parseInt(user_id),
        upload_date: new Date().toISOString(),
        file_type: fileExtension,
        title: documentTitle,
        category: category || null,
        priority: finalPriority,
        source: source || null,
        tags: finalTags,
        url: documentUrl,
        entry_method: entryMethod
      };

      let storedChunks = 0;
      try {
        storedChunks = await VectorStore.storeDocuments(chunks, metadata);
      } catch (vectorError) {
        console.error('Error storing in vector database:', vectorError);
        // If vector store fails, delete the document record
        await document.destroy();
        throw new Error(`Failed to store in vector database: ${vectorError.message}`);
      }
      
      // Update document with chunk count
      await document.update({
        chunksCount: storedChunks
      });

      return res.status(200).json({
        success: true,
        message: 'Knowledge added to knowledge base successfully',
        data: {
          id: document.id,
          document_id: documentId_uuid,
          title: documentTitle,
          category: category,
          documentId: finalDocumentId,
          priority: finalPriority,
          source: source,
          tags: finalTags,
          chunks_created: storedChunks,
          text_length: cleanedText.length,
          entry_method: entryMethod
        }
      });

    } catch (error) {
      console.error('Error adding knowledge:', error);
      
      // Provide more detailed error information
      let errorMessage = error.message || 'Unknown error';
      if (error.message && error.message.includes('Not Found')) {
        errorMessage = 'Vector database or embedding service not available. Please check Qdrant and OpenAI services.';
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error adding knowledge to knowledge base',
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  // Suggest metadata using AI
  async suggestMetadata(req, res) {
    try {
      const user_id = req.user?.id;
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { title, content } = req.body;

      if (!title && !content) {
        return res.status(400).json({
          success: false,
          message: 'Either title or content must be provided'
        });
      }

      // Truncate content if too long
      const contentToAnalyze = content ? (content.length > 2000 ? content.substring(0, 2000) : content) : '';
      
      const suggestions = await MetadataSuggestionService.suggestMetadata(
        title || '',
        contentToAnalyze || ''
      );

      return res.status(200).json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      console.error('Error suggesting metadata:', error);
      return res.status(500).json({
        success: false,
        message: 'Error generating metadata suggestions',
        error: error.message
      });
    }
  },

  // Search knowledge base
  async searchKnowledgeBase(req, res) {
    try {
      const user_id = req.user?.id;
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { query, limit = 20, category, tags, source } = req.body;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const filters = {};
      if (category) filters.category = category;
      if (tags && Array.isArray(tags)) filters.tags = tags;
      if (source) filters.source = source;

      const searchResults = await VectorStore.searchKnowledgeBase(query, parseInt(limit), filters);

      // Get document details from database
      const documentIds = searchResults.documents.map(doc => doc.document_id);
      const documents = await Document.findAll({
        where: {
          sessionId: documentIds
        },
        attributes: ['id', 'sessionId', 'title', 'category', 'documentId', 'priority', 'source', 'tags', 'chunksCount', 'processedAt', 'entryMethod', 'url']
      });

      // Merge vector search results with database records
      const enrichedResults = searchResults.documents.map(vectorDoc => {
        const dbDoc = documents.find(doc => doc.sessionId === vectorDoc.document_id);
        return {
          ...vectorDoc,
          db_id: dbDoc?.id || null,
          chunksCount: dbDoc?.chunksCount || vectorDoc.chunks.length,
          processedAt: dbDoc?.processedAt || vectorDoc.upload_date,
          entryMethod: dbDoc?.entryMethod || null,
          url: dbDoc?.url || null
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          total_results: enrichedResults.length,
          query: query,
          documents: enrichedResults
        }
      });

    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return res.status(500).json({
        success: false,
        message: 'Error searching knowledge base',
        error: error.message
      });
    }
  },

  // Bulk upload documents
  async bulkUpload(req, res) {
    try {
      const user_id = req.user?.id;
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const results = [];
      const errors = [];

      // Process files in parallel (limit to 10 concurrent)
      const processFile = async (file) => {
        try {
          const documentId = uuidv4();
          const filePath = file.path;
          const filename = file.originalname;
          const fileExt = path.extname(filename).toLowerCase();

          // Process the document
          const text = await DocumentProcessor.processFile(filePath, filename);
          const cleanedText = DocumentProcessor.cleanText(text);
          
          // Split into chunks
          const chunks = TextSplitter.splitBySentences(cleanedText, 500);
          
          // Create document record
          const document = await Document.create({
            sessionId: documentId,
            filename: file.filename,
            originalName: filename,
            fileType: fileExt,
            fileSize: file.size,
            textContent: cleanedText,
            chunksCount: chunks.length,
            processedAt: new Date(),
            title: filename.replace(/\.[^/.]+$/, ''),
            entryMethod: 'file_upload'
          });

          // Store chunks in vector database
          const metadata = {
            document_id: documentId,
            filename: filename,
            user_id: parseInt(user_id),
            upload_date: new Date().toISOString(),
            file_type: fileExt,
            title: filename.replace(/\.[^/.]+$/, ''),
            entry_method: 'file_upload'
          };

          const storedChunks = await VectorStore.storeDocuments(chunks, metadata);
          
          // Update document with chunk count
          await document.update({
            chunksCount: storedChunks
          });

          results.push({
            id: document.id,
            document_id: documentId,
            filename: filename,
            file_type: fileExt,
            file_size: file.size,
            chunks_created: storedChunks,
            text_length: cleanedText.length,
            status: 'success'
          });

          // Clean up temp file
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          errors.push({
            filename: file.originalname,
            error: fileError.message,
            status: 'failed'
          });
          
          // Clean up temp file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      };

      // Process files with concurrency limit
      const concurrencyLimit = 5;
      for (let i = 0; i < req.files.length; i += concurrencyLimit) {
        const batch = req.files.slice(i, i + concurrencyLimit);
        await Promise.all(batch.map(processFile));
      }

      return res.status(200).json({
        success: true,
        message: `Bulk upload completed: ${results.length} succeeded, ${errors.length} failed`,
        data: {
          processed: results,
          errors: errors,
          total_processed: results.length,
          total_errors: errors.length,
          total_files: req.files.length
        }
      });

    } catch (error) {
      console.error('Bulk upload error:', error);
      
      // Clean up any remaining temp files
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error during bulk upload',
        error: error.message
      });
    }
  },

  // Get knowledge base statistics
  async getKnowledgeBaseStats(req, res) {
    try {
      const user_id = req.user?.id;
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const env = require('../config/env');
      const { VECTOR_SIZE } = require('../config/qdrant');
      
      // Get vector store stats
      let vectorStoreStats = null;
      let namespaceBreakdown = null;
      let totalVectors = 0;
      
      try {
        vectorStoreStats = await VectorStore.getCollectionStats();
        totalVectors = vectorStoreStats.total_vectors || 0;
        
        // Get namespace breakdown
        const breakdown = await VectorStore.getNamespaceBreakdown();
        namespaceBreakdown = breakdown.namespace_breakdown || [];
        
        // If no breakdown from vectors, calculate from documents
        if (namespaceBreakdown.length === 0) {
          const byEntryMethod = await Document.findAll({
            attributes: [
              'entryMethod',
              [sequelize.fn('SUM', sequelize.col('chunksCount')), 'chunks']
            ],
            group: ['entryMethod'],
            raw: true
          });

          // Map entry methods to namespaces and sum chunks
          const namespaceMap = {
            'file_upload': 'general',
            'manual_entry': 'general',
            'url_scrape': 'urls'
          };

          const namespaceTotals = {};
          byEntryMethod.forEach(item => {
            const namespace = namespaceMap[item.entryMethod] || 'general';
            const chunks = parseInt(item.chunks) || 0;
            namespaceTotals[namespace] = (namespaceTotals[namespace] || 0) + chunks;
          });

          namespaceBreakdown = Object.entries(namespaceTotals).map(([name, count]) => ({
            namespace: name,
            vector_count: count
          })).sort((a, b) => b.vector_count - a.vector_count);
        }
      } catch (vectorError) {
        console.error('Error getting vector store stats:', vectorError);
        // Fallback: calculate from database
        const totalChunks = await Document.sum('chunksCount') || 0;
        totalVectors = totalChunks;
        
        const byEntryMethod = await Document.findAll({
          attributes: [
            'entryMethod',
            [sequelize.fn('SUM', sequelize.col('chunksCount')), 'chunks']
          ],
          group: ['entryMethod'],
          raw: true
        });

        const namespaceMap = {
          'file_upload': 'general',
          'manual_entry': 'general',
          'url_scrape': 'urls'
        };

        const namespaceTotals = {};
        byEntryMethod.forEach(item => {
          const namespace = namespaceMap[item.entryMethod] || 'general';
          const chunks = parseInt(item.chunks) || 0;
          namespaceTotals[namespace] = (namespaceTotals[namespace] || 0) + chunks;
        });

        namespaceBreakdown = Object.entries(namespaceTotals).map(([name, count]) => ({
          namespace: name,
          vector_count: count
        })).sort((a, b) => b.vector_count - a.vector_count);
      }

      // Calculate general namespace count (sum of general namespace)
      const generalNamespace = namespaceBreakdown.find(ns => ns.namespace === 'general');
      const generalNamespaceCount = generalNamespace ? generalNamespace.vector_count : 0;

      // Get document count from database
      const totalDocuments = await Document.count();

      // Format response to match UI
      return res.status(200).json({
        success: true,
        data: {
          // Main stats cards
          total_records: totalVectors || 0,
          total_records_formatted: (totalVectors || 0).toLocaleString(),
          general_namespace: generalNamespaceCount,
          general_namespace_formatted: generalNamespaceCount.toLocaleString(),
          embedding_dimension: VECTOR_SIZE || 768,
          
          // Additional stats
          total_documents: totalDocuments,
          total_chunks: totalVectors,
          vector_store_status: vectorStoreStats?.status || 'unknown',
          
          // Namespace breakdown table
          namespace_breakdown: namespaceBreakdown,
          
          // Metadata
          updated_at: new Date().toISOString(),
          updated_at_formatted: new Date().toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }),
          
          // Additional details for debugging
          vector_store_info: vectorStoreStats ? {
            indexed_vectors: vectorStoreStats.indexed_vectors || 0,
            segments_count: vectorStoreStats.segments_count || 0,
            status: vectorStoreStats.status
          } : null
        }
      });

    } catch (error) {
      console.error('Error getting knowledge base stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching knowledge base statistics',
        error: error.message
      });
    }
  },

  // Export knowledge base data
  async exportKnowledgeBase(req, res) {
    try {
      const user_id = req.user?.id;
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { format = 'json', category, limit } = req.query;

      // Build query
      const where = {};
      if (category) {
        where.category = category;
      }

      const queryOptions = {
        where: where,
        attributes: ['id', 'sessionId', 'title', 'category', 'documentId', 'priority', 'source', 'tags', 'chunksCount', 'processedAt', 'entryMethod', 'url', 'filename', 'originalName', 'fileType'],
        order: [['processedAt', 'DESC']]
      };

      if (limit) {
        queryOptions.limit = parseInt(limit);
      }

      const documents = await Document.findAll(queryOptions);

      if (format === 'csv') {
        // Convert to CSV
        const headers = ['ID', 'Document ID', 'Title', 'Category', 'Priority', 'Source', 'Tags', 'Chunks', 'Entry Method', 'URL', 'Processed At'];
        const rows = documents.map(doc => [
          doc.id,
          doc.sessionId,
          doc.title || '',
          doc.category || '',
          doc.priority || '',
          doc.source || '',
          Array.isArray(doc.tags) ? doc.tags.join('; ') : '',
          doc.chunksCount || 0,
          doc.entryMethod || '',
          doc.url || '',
          doc.processedAt ? new Date(doc.processedAt).toISOString() : ''
        ]);

        const csv = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="knowledge_base_export.csv"');
        return res.send(csv);
      } else {
        // Return JSON
        return res.status(200).json({
          success: true,
          data: {
            export_date: new Date().toISOString(),
            total_records: documents.length,
            format: format,
            records: documents
          }
        });
      }

    } catch (error) {
      console.error('Error exporting knowledge base:', error);
      return res.status(500).json({
        success: false,
        message: 'Error exporting knowledge base',
        error: error.message
      });
    }
  }
};

module.exports = {
  documentController,
  upload
};
