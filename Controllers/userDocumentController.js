const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { UserDocument } = require('../models');
const UserDocumentAnalysisService = require('../services/userDocumentAnalysisService');
const UserDocumentVectorService = require('../services/userDocumentVectorService');
const PropertyDocumentService = require('../services/propertyDocumentService');
const DocumentProcessor = require('../utils/documentProcessor');
const pdf = require('pdf-parse');
const { fromPath } = require('pdf2pic');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/userDocuments');
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
        const allowedTypes = ['.pdf', '.docx', '.jpg', '.jpeg', '.png'];
        const fileExt = path.extname(file.originalname).toLowerCase();

        if (allowedTypes.includes(fileExt)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type. Supported types: PDF, DOCX, JPG, PNG'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

class UserDocumentController {
    /**
     * Upload and process user documents
     */
    static async uploadDocuments(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No files uploaded'
                });
            }

            const propertyId = req.body.propertyId || req.body.property_id;
            const shouldLinkToProperty = propertyId !== undefined && propertyId !== null && propertyId !== "";
            const propertyLinkPayload = {
                documentRole: req.body.documentRole,
                document_role: req.body.document_role,
                relevance: req.body.relevance,
                effectiveDate: req.body.effectiveDate,
                effective_date: req.body.effective_date,
                expiryDate: req.body.expiryDate,
                expiry_date: req.body.expiry_date
            };

            let normalizedPropertyId = null;
            if (shouldLinkToProperty) {
                try {
                    normalizedPropertyId = await PropertyDocumentService.assertCanLinkToProperty(
                        req.user.id,
                        propertyId,
                        propertyLinkPayload
                    );
                } catch (linkError) {
                    req.files.forEach(file => {
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path);
                        }
                    });

                    return res.status(linkError.statusCode || 400).json({
                        success: false,
                        message: linkError.message
                    });
                }
            }

            const results = [];
            const documents = [];

            for (const file of req.files) {
                try {
                    // Process file to extract text
                    const textContent = await DocumentProcessor.processFile(file.path, file.originalname);
                    
                    // Analyze document with AI
                    const analysis = await UserDocumentAnalysisService.analyzeDocument(
                        textContent,
                        file.originalname,
                        path.extname(file.originalname).toLowerCase()
                    );

                    // Create userDocument record
                    const userDocument = await UserDocument.create({
                        user_id: req.user.id,
                        name: file.originalname,
                        doc_type: analysis.doc_type,
                        status: analysis.status,
                        category: analysis.category,
                        tags: analysis.tags,
                        date: analysis.date,
                        expiry_date: analysis.expiry_date,
                        file_path: file.path,
                        file_type: path.extname(file.originalname).toLowerCase(),
                        file_size: file.size,
                        text_content: textContent,
                        ai_analysis: analysis.ai_analysis,
                        processed_at: new Date()
                    });

                    // Store document chunks in vector database
                    const vectorIds = await UserDocumentVectorService.storeDocumentChunks(
                        textContent,
                        {
                            document_id: userDocument.id,
                            user_id: req.user.id,
                            filename: file.originalname,
                            doc_type: analysis.doc_type,
                            category: analysis.category,
                            tags: analysis.tags
                        }
                    );

                    // Update document with vector IDs
                    await userDocument.update({
                        chunks_count: vectorIds.length,
                        vector_ids: vectorIds
                    });

                    let propertyLink = null;
                    if (normalizedPropertyId) {
                        propertyLink = await PropertyDocumentService.linkUserDocumentToProperty(
                            req.user.id,
                            normalizedPropertyId,
                            userDocument.id,
                            propertyLinkPayload
                        );
                    }

                    documents.push({
                        id: userDocument.id,
                        name: userDocument.name,
                        doc_type: userDocument.doc_type,
                        status: userDocument.status,
                        category: userDocument.category,
                        tags: userDocument.tags,
                        date: userDocument.date,
                        expiry_date: userDocument.expiry_date,
                        file_type: userDocument.file_type,
                        file_size: userDocument.file_size,
                        chunks_count: userDocument.chunks_count,
                        processed_at: userDocument.processed_at,
                        property_link: propertyLink
                    });

                    results.push({
                        filename: file.originalname,
                        status: 'success',
                        chunks_created: vectorIds.length
                    });

                } catch (fileError) {
                    console.error(`Error processing file ${file.originalname}:`, fileError);
                    
                    // Clean up file if it exists
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }

                    results.push({
                        filename: file.originalname,
                        status: 'error',
                        error: fileError.message
                    });
                }
            }

            res.json({
                success: true,
                message: `Successfully processed ${documents.length} document(s)`,
                data: {
                    documents: documents,
                    results: results
                }
            });

        } catch (error) {
            console.error('Upload error:', error);
            
            // Clean up uploaded files
            if (req.files) {
                req.files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error uploading documents',
                error: error.message
            });
        }
    }

    /**
     * Get all user documents with filtering and pagination
     */
    static async getUserDocuments(req, res) {
        try {
            const { 
                page = 1, 
                limit = 10, 
                category, 
                status, 
                doc_type, 
                search,
                sort_by = 'created_at',
                sort_order = 'DESC'
            } = req.query;

            const offset = (page - 1) * limit;
            const whereClause = {
                user_id: req.user.id,
                is_active: true
            };

            // Add filters
            if (category) whereClause.category = category;
            if (status) whereClause.status = status;
            if (doc_type) whereClause.doc_type = doc_type;
            if (search) {
                whereClause.name = {
                    [require('sequelize').Op.like]: `%${search}%`
                };
            }

            const { count, rows: documents } = await UserDocument.findAndCountAll({
                where: whereClause,
                order: [[sort_by, sort_order]],
                limit: parseInt(limit),
                offset: parseInt(offset),
                attributes: [
                    'id', 'name', 'doc_type', 'status', 'category', 'tags',
                    'date', 'expiry_date', 'file_type', 'file_size',
                    'chunks_count', 'processed_at', 'created_at', 'updated_at'
                ]
            });

            res.json({
                success: true,
                data: {
                    documents: documents,
                    pagination: {
                        current_page: parseInt(page),
                        total_pages: Math.ceil(count / limit),
                        total_documents: count,
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get user documents error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching documents',
                error: error.message
            });
        }
    }

    /**
     * Get single document by ID
     */
    static async getDocumentById(req, res) {
        try {
            const { id } = req.params;

            const document = await UserDocument.findOne({
                where: {
                    id: id,
                    user_id: req.user.id,
                    is_active: true
                }
            });

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: 'Document not found'
                });
            }

            res.json({
                success: true,
                data: document
            });

        } catch (error) {
            console.error('Get document error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching document',
                error: error.message
            });
        }
    }

    /**
     * Get document preview (file content)
     */
    static async getDocumentPreview(req, res) {
        try {
            const { id } = req.params;

            const document = await UserDocument.findOne({
                where: {
                    id: id,
                    user_id: req.user.id,
                    is_active: true
                }
            });

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: 'Document not found'
                });
            }

            // Check if file exists
            if (!fs.existsSync(document.file_path)) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found on server'
                });
            }

            // Set appropriate headers based on file type
            const fileExt = path.extname(document.file_path).toLowerCase();
            let contentType = 'application/octet-stream';

            switch (fileExt) {
                case '.pdf':
                    contentType = 'application/pdf';
                    break;
                case '.docx':
                    contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    break;
                case '.jpg':
                case '.jpeg':
                    contentType = 'image/jpeg';
                    break;
                case '.png':
                    contentType = 'image/png';
                    break;
            }

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `inline; filename="${document.name}"`);

            // Stream the file
            const fileStream = fs.createReadStream(document.file_path);
            fileStream.pipe(res);

        } catch (error) {
            console.error('Document preview error:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating document preview',
                error: error.message
            });
        }
    }

    /**
     * Delete document
     */
    static async deleteDocument(req, res) {
        try {
            const { id } = req.params;

            const document = await UserDocument.findOne({
                where: {
                    id: id,
                    user_id: req.user.id,
                    is_active: true
                }
            });

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: 'Document not found'
                });
            }

            // Delete from vector database
            await UserDocumentVectorService.deleteDocumentChunks(document.id, req.user.id);

            // Delete physical file
            if (fs.existsSync(document.file_path)) {
                fs.unlinkSync(document.file_path);
            }

            // Soft delete from database
            await document.update({ is_active: false });

            res.json({
                success: true,
                message: 'Document deleted successfully'
            });

        } catch (error) {
            console.error('Delete document error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting document',
                error: error.message
            });
        }
    }

    /**
     * Update document metadata
     */
    static async updateDocument(req, res) {
        try {
            const { id } = req.params;
            const { doc_type, status, category, tags, date, expiry_date } = req.body;

            const document = await UserDocument.findOne({
                where: {
                    id: id,
                    user_id: req.user.id,
                    is_active: true
                }
            });

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: 'Document not found'
                });
            }

            // Update document
            await document.update({
                doc_type: doc_type || document.doc_type,
                status: status || document.status,
                category: category || document.category,
                tags: tags || document.tags,
                date: date || document.date,
                expiry_date: expiry_date || document.expiry_date
            });

            res.json({
                success: true,
                message: 'Document updated successfully',
                data: document
            });

        } catch (error) {
            console.error('Update document error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating document',
                error: error.message
            });
        }
    }

    /**
     * Update document filename only
     */
    static async updateDocumentName(req, res) {
        try {
            const { id } = req.params;
            const { name } = req.body;

            // Validate filename
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Filename is required and must be a non-empty string'
                });
            }

            if (name.length > 255) {
                return res.status(400).json({
                    success: false,
                    message: 'Filename cannot exceed 255 characters'
                });
            }

            const trimmedName = name.trim();

            const document = await UserDocument.findOne({
                where: {
                    id: id,
                    user_id: req.user.id,
                    is_active: true
                }
            });

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: 'Document not found'
                });
            }

            // Update only the filename
            await document.update({
                name: trimmedName
            });

            res.json({
                success: true,
                message: 'Document filename updated successfully',
                data: {
                    id: document.id,
                    name: document.name,
                    updated_at: document.updated_at
                }
            });

        } catch (error) {
            console.error('Update document name error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating document filename',
                error: error.message
            });
        }
    }

    /**
     * Search documents
     */
    static async searchDocuments(req, res) {
        try {
            const { query, filters = {} } = req.body;

            if (!query || query.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Search query is required'
                });
            }

            // Search in vector database
            const searchResults = await UserDocumentVectorService.searchUserDocuments(
                query,
                req.user.id,
                filters,
                20
            );

            // Get unique document IDs from search results
            const documentIds = [...new Set(searchResults.map(result => result.metadata.document_id))];

            // Get full document details
            const documents = await UserDocument.findAll({
                where: {
                    id: documentIds,
                    user_id: req.user.id,
                    is_active: true
                },
                attributes: [
                    'id', 'name', 'doc_type', 'status', 'category', 'tags',
                    'date', 'expiry_date', 'file_type', 'file_size',
                    'chunks_count', 'processed_at', 'created_at'
                ]
            });

            res.json({
                success: true,
                data: {
                    documents: documents,
                    search_results: searchResults,
                    query: query
                }
            });

        } catch (error) {
            console.error('Search documents error:', error);
            res.status(500).json({
                success: false,
                message: 'Error searching documents',
                error: error.message
            });
        }
    }

    /**
     * Get document statistics
     */
    static async getDocumentStats(req, res) {
        try {
            const stats = await UserDocument.findAll({
                where: {
                    user_id: req.user.id,
                    is_active: true
                },
                attributes: [
                    'category',
                    'status',
                    'doc_type',
                    [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
                ],
                group: ['category', 'status', 'doc_type'],
                raw: true
            });

            // Process stats into a more useful format
            const processedStats = {
                total_documents: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
                by_category: {},
                by_status: {},
                by_type: {}
            };

            stats.forEach(stat => {
                // By category
                if (!processedStats.by_category[stat.category]) {
                    processedStats.by_category[stat.category] = 0;
                }
                processedStats.by_category[stat.category] += parseInt(stat.count);

                // By status
                if (!processedStats.by_status[stat.status]) {
                    processedStats.by_status[stat.status] = 0;
                }
                processedStats.by_status[stat.status] += parseInt(stat.count);

                // By type
                if (!processedStats.by_type[stat.doc_type]) {
                    processedStats.by_type[stat.doc_type] = 0;
                }
                processedStats.by_type[stat.doc_type] += parseInt(stat.count);
            });

            res.json({
                success: true,
                data: processedStats
            });

        } catch (error) {
            console.error('Get document stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching document statistics',
                error: error.message
            });
        }
    }

    /**
     * Get document preview
     */
    static async getDocumentPreview(req, res) {
        try {
            const { id } = req.params;

            const document = await UserDocument.findOne({
                where: {
                    id: id,
                    user_id: req.user.id,
                    is_active: true
                }
            });

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: 'Document not found'
                });
            }

            // Check if file exists
            if (!fs.existsSync(document.file_path)) {
                return res.status(404).json({
                    success: false,
                    message: 'Document file not found on server'
                });
            }

            // Get file stats
            const stats = fs.statSync(document.file_path);
            const fileSizeInBytes = stats.size;
            const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

            // For PDF files, return first page as image
            if (document.file_type === '.pdf') {
                try {
                    // Convert first page of PDF to image using pdf2pic
                    const convert = fromPath(document.file_path, {
                        density: 100,
                        saveFilename: `preview_${document.id}_${Date.now()}`,
                        savePath: path.join(__dirname, '../uploads/previews'),
                        format: 'png',
                        width: 800,
                        height: 1200
                    });

                    const result = await convert(1, { responseType: 'base64' });
                    
                    if (result && result.base64) {
                        return res.json({
                            success: true,
                            data: {
                                id: document.id,
                                name: document.name,
                                file_type: document.file_type,
                                file_size: fileSizeInMB + ' MB',
                                status: document.status,
                                doc_type: document.doc_type,
                                category: document.category,
                                tags: document.tags,
                                extracted_date: document.extracted_date,
                                expiry_date: document.expiry_date,
                                preview_type: 'image',
                                preview_image: `data:image/png;base64,${result.base64}`,
                                preview_content: 'First page of PDF document',
                                has_full_content: document.text_content ? true : false,
                                chunks_count: document.chunks_count,
                                created_at: document.created_at,
                                updated_at: document.updated_at
                            }
                        });
                    } else {
                        throw new Error('No image data returned from PDF conversion');
                    }

                } catch (error) {
                    console.error('PDF preview error:', error);
                    // Fallback to text content if image conversion fails
                    let previewContent = '';
                    
                    if (document.text_content) {
                        previewContent = document.text_content.length > 2000 
                            ? document.text_content.substring(0, 2000) + '...' 
                            : document.text_content;
                    } else {
                        try {
                            const extractedText = await DocumentProcessor.processFile(document.file_path);
                            previewContent = extractedText.length > 2000 
                                ? extractedText.substring(0, 2000) + '...' 
                                : extractedText;
                        } catch (extractError) {
                            previewContent = 'Preview not available for this PDF file.';
                        }
                    }

                    return res.json({
                        success: true,
                        data: {
                            id: document.id,
                            name: document.name,
                            file_type: document.file_type,
                            file_size: fileSizeInMB + ' MB',
                            status: document.status,
                            doc_type: document.doc_type,
                            category: document.category,
                            tags: document.tags,
                            extracted_date: document.extracted_date,
                            expiry_date: document.expiry_date,
                            preview_type: 'text',
                            preview_content: previewContent,
                            has_full_content: document.text_content ? true : false,
                            chunks_count: document.chunks_count,
                            created_at: document.created_at,
                            updated_at: document.updated_at
                        }
                    });
                }
            }

            // For text files, return the content
            if (document.file_type === '.txt' || document.file_type === '.docx') {
                let previewContent = '';
                
                if (document.text_content) {
                    // Use stored text content for preview
                    previewContent = document.text_content.length > 2000 
                        ? document.text_content.substring(0, 2000) + '...' 
                        : document.text_content;
                } else {
                    // Try to extract text for preview
                    try {
                        const extractedText = await DocumentProcessor.processFile(document.file_path);
                        previewContent = extractedText.length > 2000 
                            ? extractedText.substring(0, 2000) + '...' 
                            : extractedText;
                    } catch (error) {
                        previewContent = 'Preview not available for this file type.';
                    }
                }

                return res.json({
                    success: true,
                    data: {
                        id: document.id,
                        name: document.name,
                        file_type: document.file_type,
                        file_size: fileSizeInMB + ' MB',
                        status: document.status,
                        doc_type: document.doc_type,
                        category: document.category,
                        tags: document.tags,
                        extracted_date: document.extracted_date,
                        expiry_date: document.expiry_date,
                        preview_type: 'text',
                        preview_content: previewContent,
                        has_full_content: document.text_content ? true : false,
                        chunks_count: document.chunks_count,
                        created_at: document.created_at,
                        updated_at: document.updated_at
                    }
                });
            }

            // For image files, return metadata only
            if (['.jpg', '.jpeg', '.png'].includes(document.file_type)) {
                return res.json({
                    success: true,
                    data: {
                        id: document.id,
                        name: document.name,
                        file_type: document.file_type,
                        file_size: fileSizeInMB + ' MB',
                        status: document.status,
                        doc_type: document.doc_type,
                        category: document.category,
                        tags: document.tags,
                        extracted_date: document.extracted_date,
                        expiry_date: document.expiry_date,
                        preview_type: 'image',
                        preview_content: '[IMAGE FILE] - Preview not available for image files. Use PDF or DOCX files for text-based document analysis.',
                        has_full_content: false,
                        chunks_count: document.chunks_count,
                        created_at: document.created_at,
                        updated_at: document.updated_at
                    }
                });
            }

            // For other file types
            return res.json({
                success: true,
                data: {
                    id: document.id,
                    name: document.name,
                    file_type: document.file_type,
                    file_size: fileSizeInMB + ' MB',
                    status: document.status,
                    doc_type: document.doc_type,
                    category: document.category,
                    tags: document.tags,
                    extracted_date: document.extracted_date,
                    expiry_date: document.expiry_date,
                    preview_type: 'none',
                    preview_content: 'Preview not available for this file type.',
                    has_full_content: false,
                    chunks_count: document.chunks_count,
                    created_at: document.created_at,
                    updated_at: document.updated_at
                }
            });

        } catch (error) {
            console.error('Get document preview error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching document preview',
                error: error.message
            });
        }
    }
}

module.exports = { UserDocumentController, upload };
