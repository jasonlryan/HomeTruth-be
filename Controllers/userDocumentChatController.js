const { UserDocument, UserDocumentChatHistory } = require('../models');
const UserDocumentAnalysisService = require('../services/userDocumentAnalysisService');
const UserDocumentVectorService = require('../services/userDocumentVectorService');
const OpenAI = require('openai');
const env = require('../config/env');
const { v4: uuidv4 } = require('uuid');

const openai = new OpenAI({
    apiKey: env.ai.OpenAIKey
});

const LLM_MODEL = process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';

class UserDocumentChatController {
    /**
     * Helper function to retry database queries on timeout
     */
    static async retryQuery(queryFn, maxRetries = 3, defaultValue = []) {
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                return await queryFn();
            } catch (dbError) {
                retryCount++;
                if (dbError.name === 'SequelizeDatabaseError' && 
                    (dbError.parent?.code === 'ETIMEDOUT' || dbError.original?.code === 'ETIMEDOUT')) {
                    if (retryCount >= maxRetries) {
                        console.error(`Database timeout after ${maxRetries} retries:`, dbError.message);
                        return defaultValue;
                    }
                    // Exponential backoff: wait 1s, 2s, 4s
                    const waitTime = Math.pow(2, retryCount - 1) * 1000;
                    console.warn(`Database timeout, retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // Non-timeout error, don't retry
                    console.error('Database error:', dbError.message);
                    return defaultValue;
                }
            }
        }
        return defaultValue;
    }

    /**
     * Chat with a specific document
     */
    static async chatWithDocument(req, res) {
        try {
            const { id } = req.params;
            const { question, conversation_id } = req.body;

            if (!question || question.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Question is required'
                });
            }

            // Get document
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

            // Generate or use existing conversation ID
            const chatConversationId = conversation_id || uuidv4();

            // Search for relevant chunks in this specific document
            const relevantChunks = await UserDocumentVectorService.searchSimilarChunks(
                question,
                req.user.id,
                document.id,
                5
            );

            let aiResponse = '';

            if (relevantChunks.length > 0) {
                // Use RAG approach with relevant chunks
                const context = relevantChunks.map(chunk => chunk.text).join('\n\n');
                
                const prompt = `Based on the following document content, answer the user's question. Be specific and cite relevant parts of the document.

Document: ${document.name}
Document Type: ${document.doc_type}
Category: ${document.category}

Relevant content from document:
${context}

User question: ${question}

Provide a helpful, accurate answer based on the document content. If the information is not available in the document, say so clearly.`;

                try {
                    const response = await openai.chat.completions.create({
                        model: LLM_MODEL,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a helpful assistant that answers questions about property documents. Be accurate and cite specific information from the document when possible.'
                            },
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        temperature: 0.3,
                        top_p: 0.9,
                        max_tokens: 4096
                    });

                    aiResponse = response.choices[0].message.content;

                } catch (openaiError) {
                    console.error('OpenAI error:', openaiError);
                    aiResponse = 'I encountered an error while processing your question. Please try again.';
                }

            } else {
                // Fallback to simple analysis if no relevant chunks found
                try {
                    aiResponse = await UserDocumentAnalysisService.analyzeForChat(
                        document.text_content || '',
                        question
                    );
                } catch (analysisError) {
                    console.error('Analysis error:', analysisError);
                    aiResponse = 'I couldn\'t find relevant information in this document to answer your question. Please try rephrasing your question or check if the document contains the information you\'re looking for.';
                }
            }

            // Save chat history
            try {
                await UserDocumentChatHistory.create({
                    user_id: req.user.id,
                    document_id: document.id,
                    conversation_id: chatConversationId,
                    user_message: question.trim(),
                    assistant_reply: aiResponse,
                    has_context: relevantChunks.length > 0,
                    is_saved: false
                });
            } catch (saveError) {
                console.error('Error saving chat history:', saveError);
                // Continue even if saving fails
            }

            // Get ALL chat history for this document (all conversations)
            const allChatHistory = await UserDocumentChatController.retryQuery(async () => {
                return await UserDocumentChatHistory.findAll({
                    where: {
                        user_id: req.user.id,
                        document_id: document.id
                    },
                    order: [['created_at', 'ASC']],
                    attributes: ['id', 'conversation_id', 'user_message', 'assistant_reply', 'created_at', 'has_context']
                });
            });

            // Format chat history for frontend display
            const formattedMessages = allChatHistory.map(chat => ({
                id: chat.id,
                type: 'message',
                conversation_id: chat.conversation_id,
                messages: [
                    {
                        role: 'user',
                        content: chat.user_message,
                        timestamp: chat.created_at
                    },
                    {
                        role: 'assistant',
                        content: chat.assistant_reply,
                        timestamp: chat.created_at,
                        has_context: chat.has_context
                    }
                ]
            }));

            res.json({
                success: true,
                data: {
                    document_id: document.id,
                    document_name: document.name,
                    document_type: document.doc_type,
                    conversation_id: chatConversationId,
                    current_question: question.trim(),
                    current_answer: aiResponse,
                    has_context: relevantChunks.length > 0,
                    chat_history: formattedMessages,
                    total_messages: formattedMessages.length
                }
            });

        } catch (error) {
            console.error('Document chat error:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing document chat',
                error: error.message
            });
        }
    }

    /**
     * Get chat history for a specific document
     */
    static async getDocumentChatHistory(req, res) {
        try {
            const { id } = req.params;
            const { conversation_id } = req.query;

            // Get document
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

            // Build where clause
            const whereClause = {
                user_id: req.user.id,
                document_id: document.id
            };

            if (conversation_id) {
                whereClause.conversation_id = conversation_id;
            }

            // Get chat history with retry logic
            const chatHistory = await UserDocumentChatController.retryQuery(async () => {
                return await UserDocumentChatHistory.findAll({
                    where: whereClause,
                    order: [['created_at', 'ASC']],
                    attributes: ['id', 'conversation_id', 'user_message', 'assistant_reply', 'created_at', 'has_context']
                });
            });

            // Format chat history for frontend display
            const formatChatHistory = (history) => {
                return history.map(chat => ({
                    id: chat.id,
                    type: 'message',
                    conversation_id: chat.conversation_id,
                    messages: [
                        {
                            role: 'user',
                            content: chat.user_message,
                            timestamp: chat.created_at
                        },
                        {
                            role: 'assistant',
                            content: chat.assistant_reply,
                            timestamp: chat.created_at,
                            has_context: chat.has_context
                        }
                    ]
                }));
            };

            // Group by conversation_id if no specific conversation requested
            let groupedHistory = chatHistory;
            if (!conversation_id) {
                groupedHistory = chatHistory.reduce((acc, chat) => {
                    const convId = chat.conversation_id;
                    if (!acc[convId]) {
                        acc[convId] = [];
                    }
                    acc[convId].push(chat);
                    return acc;
                }, {});

                // Format each conversation
                Object.keys(groupedHistory).forEach(convId => {
                    groupedHistory[convId] = formatChatHistory(groupedHistory[convId]);
                });
            } else {
                // Format single conversation
                groupedHistory = formatChatHistory(chatHistory);
            }

            res.json({
                success: true,
                data: {
                    document_id: document.id,
                    document_name: document.name,
                    conversation_id: conversation_id || null,
                    chat_history: groupedHistory,
                    total_conversations: conversation_id ? 1 : Object.keys(groupedHistory).length,
                    total_messages: conversation_id ? groupedHistory.length : Object.values(groupedHistory).flat().length
                }
            });

        } catch (error) {
            console.error('Get chat history error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving chat history',
                error: error.message
            });
        }
    }

    /**
     * Get document summary
     */
    static async getDocumentSummary(req, res) {
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

            if (!document.text_content) {
                return res.status(400).json({
                    success: false,
                    message: 'Document has no text content to summarize'
                });
            }

            // Get document chunks for better summarization
            const chunks = await UserDocumentVectorService.getDocumentChunks(document.id, req.user.id);
            const content = chunks.map(chunk => chunk.text).join('\n\n');

            const summaryPrompt = `Summarize the following document in a clear and helpful way. Focus on key information, important dates, and main points.

Document: ${document.name}
Document Type: ${document.doc_type}
Category: ${document.category}

Content:
${content.substring(0, 3000)}

Provide a comprehensive summary that highlights the most important information.`;

            try {
                const response = await openai.chat.completions.create({
                    model: LLM_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert at summarizing property documents. Provide clear, comprehensive summaries that highlight key information.'
                        },
                        {
                            role: 'user',
                            content: summaryPrompt
                        }
                    ],
                    temperature: 0.3,
                    top_p: 0.9,
                    max_tokens: 4096
                });

                res.json({
                    success: true,
                    data: {
                        document_id: document.id,
                        document_name: document.name,
                        document_type: document.doc_type,
                        summary: response.choices[0].message.content,
                        metadata: {
                            category: document.category,
                            status: document.status,
                            tags: document.tags,
                            date: document.date,
                            expiry_date: document.expiry_date
                        }
                    }
                });

            } catch (openaiError) {
                console.error('Summary generation error:', openaiError);
                res.status(500).json({
                    success: false,
                    message: 'Error generating document summary',
                    error: openaiError.message
                });
            }

        } catch (error) {
            console.error('Get document summary error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching document summary',
                error: error.message
            });
        }
    }

    /**
     * Get suggested questions for a document
     */
    static async getSuggestedQuestions(req, res) {
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

            // Generate suggested questions based on document type and content
            const suggestedQuestions = this.generateSuggestedQuestions(document);

            res.json({
                success: true,
                data: {
                    document_id: document.id,
                    document_name: document.name,
                    document_type: document.doc_type,
                    suggested_questions: suggestedQuestions
                }
            });

        } catch (error) {
            console.error('Get suggested questions error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching suggested questions',
                error: error.message
            });
        }
    }

    /**
     * Generate suggested questions based on document type
     */
    static generateSuggestedQuestions(document) {
        const baseQuestions = [
            'What is the main purpose of this document?',
            'What are the key dates mentioned?',
            'Are there any important deadlines or expiry dates?',
            'What are the main terms and conditions?'
        ];

        const typeSpecificQuestions = {
            'Lease Agreement': [
                'When does the tenancy start and end?',
                'What is the monthly rent amount?',
                'What are the tenant\'s responsibilities?',
                'Is there a break clause?',
                'Can I have pets in this property?',
                'What\'s the notice period for moving out?'
            ],
            'Financial Statement': [
                'What is the account balance?',
                'What are the main transactions?',
                'Are there any unusual charges?',
                'What is the statement period?'
            ],
            'Title Deed': [
                'Who owns this property?',
                'What is the property address?',
                'Are there any restrictions on the property?',
                'What is the property description?'
            ],
            'EPC Certificate': [
                'What is the energy efficiency rating?',
                'What are the main energy features?',
                'What improvements are recommended?',
                'When does this certificate expire?'
            ],
            'Property Survey Report': [
                'What are the main findings?',
                'Are there any structural issues?',
                'What repairs are recommended?',
                'What is the property condition?'
            ]
        };

        const specificQuestions = typeSpecificQuestions[document.doc_type] || [];
        return [...baseQuestions, ...specificQuestions].slice(0, 8); // Limit to 8 questions
    }

    /**
     * Get document insights and analysis
     */
    static async getDocumentInsights(req, res) {
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

            // Get chunks for analysis
            const chunks = await UserDocumentVectorService.getDocumentChunks(document.id, req.user.id);
            const content = chunks.map(chunk => chunk.text).join('\n\n');

            const insightsPrompt = `Analyze this document and provide key insights, important information, and any potential issues or concerns.

Document: ${document.name}
Document Type: ${document.doc_type}
Category: ${document.category}

Content:
${content.substring(0, 3000)}

Provide insights about:
1. Key information and important details
2. Any potential issues or concerns
3. Important dates and deadlines
4. Recommendations or next steps
5. Any red flags or areas of attention`;

            try {
                const response = await openai.chat.completions.create({
                    model: LLM_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert property document analyst. Provide detailed insights and analysis of property-related documents.'
                        },
                        {
                            role: 'user',
                            content: insightsPrompt
                        }
                    ],
                    temperature: 0.3,
                    top_p: 0.9,
                    max_tokens: 4096
                });

                res.json({
                    success: true,
                    data: {
                        document_id: document.id,
                        document_name: document.name,
                        document_type: document.doc_type,
                        insights: response.choices[0].message.content,
                        metadata: {
                            category: document.category,
                            status: document.status,
                            tags: document.tags,
                            date: document.date,
                            expiry_date: document.expiry_date,
                            chunks_analyzed: chunks.length
                        }
                    }
                });

            } catch (openaiError) {
                console.error('Insights generation error:', openaiError);
                res.status(500).json({
                    success: false,
                    message: 'Error generating document insights',
                    error: openaiError.message
                });
            }

        } catch (error) {
            console.error('Get document insights error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching document insights',
                error: error.message
            });
        }
    }

    /**
     * Get all chats for a document (simplified version of chat history)
     */
    static async getDocumentChats(req, res) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20, conversation_id } = req.query;

            // Find the document
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

            // Build where clause
            const whereClause = {
                user_id: req.user.id,
                document_id: document.id
            };

            if (conversation_id) {
                whereClause.conversation_id = conversation_id;
            }

            // Calculate pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Get total count with retry logic
            const totalCount = await UserDocumentChatController.retryQuery(async () => {
                return await UserDocumentChatHistory.count({
                    where: whereClause
                });
            }, 3, 0);

            // Get chat history with pagination and retry logic
            const chatHistory = await UserDocumentChatController.retryQuery(async () => {
                return await UserDocumentChatHistory.findAll({
                    where: whereClause,
                    order: [['created_at', 'DESC']], // Most recent first
                    limit: parseInt(limit),
                    offset: offset,
                    attributes: ['id', 'conversation_id', 'user_message', 'assistant_reply', 'created_at', 'has_context']
                });
            });

            // Format chat history for frontend display
            const formattedChats = chatHistory.map(chat => ({
                id: chat.id,
                conversation_id: chat.conversation_id,
                user_message: chat.user_message,
                assistant_reply: chat.assistant_reply,
                has_context: chat.has_context,
                created_at: chat.created_at,
                updated_at: chat.updated_at
            }));

            // Calculate pagination info
            const totalPages = Math.ceil(totalCount / parseInt(limit));
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            res.json({
                success: true,
                data: {
                    document_id: document.id,
                    document_name: document.name,
                    chats: formattedChats,
                    pagination: {
                        current_page: parseInt(page),
                        total_pages: totalPages,
                        total_count: totalCount,
                        limit: parseInt(limit),
                        has_next_page: hasNextPage,
                        has_prev_page: hasPrevPage
                    },
                    filters: {
                        conversation_id: conversation_id || null
                    }
                }
            });

        } catch (error) {
            console.error('Get document chats error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching document chats',
                error: error.message
            });
        }
    }
}

module.exports = UserDocumentChatController;
