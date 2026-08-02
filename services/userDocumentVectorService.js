const { v4: uuidv4 } = require('uuid');
const { qdrantClient } = require('../config/qdrant');
const OpenAIEmbeddingService = require('./openaiEmbeddingService');
const TextSplitter = require('../utils/textSplitter');
const env = require('../config/env');

class UserDocumentVectorService {
    static normalizePositiveInteger(value, fieldName) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new Error(`${fieldName} must be a positive integer`);
        }
        return parsed;
    }

    static normalizeIdList(values) {
        if (!Array.isArray(values)) return null;
        return [...new Set(values
            .map((value) => Number.parseInt(value, 10))
            .filter((value) => Number.isInteger(value) && value > 0))];
    }

    static buildUserDocumentFilter(userId, filters = {}) {
        const normalizedUserId = this.normalizePositiveInteger(userId, 'userId');
        const filter = {
            must: [
                {
                    key: "user_id",
                    match: {
                        value: normalizedUserId
                    }
                }
            ]
        };

        const documentIds = this.normalizeIdList(filters.documentIds || filters.document_ids);
        if (documentIds) {
            filter.must.push({
                key: "document_id",
                match: {
                    any: documentIds
                }
            });
        } else {
            const documentId = filters.documentId || filters.document_id;
            if (documentId) {
                filter.must.push({
                    key: "document_id",
                    match: {
                        value: this.normalizePositiveInteger(documentId, 'documentId')
                    }
                });
            }
        }

        const propertyId = filters.propertyId || filters.property_id;
        if (propertyId) {
            filter.must.push({
                key: "property_id",
                match: {
                    value: this.normalizePositiveInteger(propertyId, 'propertyId')
                }
            });
        }

        if (filters.category) {
            filter.must.push({
                key: "category",
                match: {
                    value: filters.category
                }
            });
        }

        if (filters.doc_type) {
            filter.must.push({
                key: "doc_type",
                match: {
                    value: filters.doc_type
                }
            });
        }

        if (filters.tags && filters.tags.length > 0) {
            filter.must.push({
                key: "tags",
                match: {
                    any: filters.tags
                }
            });
        }

        return filter;
    }

    static formatSearchResults(searchResult) {
        return searchResult.map((result) => ({
            id: result.id,
            text: result.payload.text,
            score: result.score,
            metadata: {
                document_id: result.payload.document_id,
                user_id: result.payload.user_id,
                property_id: result.payload.property_id || null,
                property_ids: result.payload.property_ids || [],
                filename: result.payload.filename,
                doc_type: result.payload.doc_type,
                category: result.payload.category,
                tags: result.payload.tags || [],
                chunk_index: result.payload.chunk_index
            }
        }));
    }

    /**
     * Store document chunks in vector database
     * @param {string} textContent - Document text content
     * @param {Object} metadata - Document metadata
     * @returns {Array} Array of vector IDs
     */
    static async storeDocumentChunks(textContent, metadata) {
        try {
            // Split text into chunks
            const chunks = TextSplitter.splitText(textContent, 500, 50);
            const vectorIds = [];

            for (let i = 0; i < chunks.length; i++) {
                try {
                    // Create embedding for chunk
                    const chunkText = typeof chunks[i] === 'string' ? chunks[i] : chunks[i].text;
                    const embedding = await OpenAIEmbeddingService.generateEmbedding(chunkText);
                    
                    // Generate unique ID for this chunk
                    const vectorId = uuidv4();
                    vectorIds.push(vectorId);

                    // Store in Qdrant
                    await qdrantClient.upsert(env.qdrant.userDocumentsCollection, {
                        points: [{
                            id: vectorId,
                            vector: embedding,
                            payload: {
                                text: chunkText,
                                chunk_index: i,
                                document_id: metadata.document_id,
                                user_id: metadata.user_id,
                                filename: metadata.filename,
                                doc_type: metadata.doc_type,
                                category: metadata.category,
                                tags: metadata.tags || [],
                                ...metadata
                            }
                        }]
                    });

                } catch (chunkError) {
                    console.error(`Error processing chunk ${i}:`, chunkError);
                    // Continue with other chunks
                }
            }

            return vectorIds;

        } catch (error) {
            console.error('Error storing document chunks:', error);
            throw error;
        }
    }

    /**
     * Search for similar chunks in user's documents
     * @param {string} query - Search query
     * @param {number} userId - User ID
     * @param {number} documentId - Optional specific document ID
     * @param {number} limit - Number of results to return
     * @returns {Array} Similar chunks
     */
    static async searchSimilarChunks(query, userId, documentId = null, limit = 5) {
        try {
            // Create query embedding
            const queryEmbedding = await OpenAIEmbeddingService.generateEmbedding(query);
            return this.searchUserDocumentsByEmbedding(
                queryEmbedding,
                userId,
                documentId ? { documentId } : {},
                limit
            );

        } catch (error) {
            console.error('Error searching similar chunks:', error);
            return [];
        }
    }

    /**
     * Delete document chunks from vector database
     * @param {number} documentId - Document ID
     * @param {number} userId - User ID
     */
    static async deleteDocumentChunks(documentId, userId) {
        try {
            await qdrantClient.delete(env.qdrant.userDocumentsCollection, {
                filter: {
                    must: [
                        {
                            key: "document_id",
                            match: {
                                value: documentId
                            }
                        },
                        {
                            key: "user_id",
                            match: {
                                value: userId
                            }
                        }
                    ]
                }
            });
        } catch (error) {
            console.error('Error deleting document chunks:', error);
            throw error;
        }
    }

    /**
     * Delete all user's document chunks
     * @param {number} userId - User ID
     */
    static async deleteUserChunks(userId) {
        try {
            await qdrantClient.delete(env.qdrant.userDocumentsCollection, {
                filter: {
                    must: [
                        {
                            key: "user_id",
                            match: {
                                value: userId
                            }
                        }
                    ]
                }
            });
        } catch (error) {
            console.error('Error deleting user chunks:', error);
            throw error;
        }
    }

    /**
     * Get document chunks for a specific document
     * @param {number} documentId - Document ID
     * @param {number} userId - User ID
     * @returns {Array} Document chunks
     */
    static async getDocumentChunks(documentId, userId) {
        try {
            const searchResult = await qdrantClient.scroll(
                env.qdrant.userDocumentsCollection,
                {
                    filter: {
                        must: [
                            {
                                key: "document_id",
                                match: {
                                    value: documentId
                                }
                            },
                            {
                                key: "user_id",
                                match: {
                                    value: userId
                                }
                            }
                        ]
                    },
                    with_payload: true,
                    limit: 1000 // Adjust based on needs
                }
            );

            return searchResult.points.map((point) => ({
                id: point.id,
                text: point.payload.text,
                chunk_index: point.payload.chunk_index,
                metadata: point.payload
            }));

        } catch (error) {
            console.error('Error getting document chunks:', error);
            return [];
        }
    }

    /**
     * Update document chunks (useful when document is updated)
     * @param {number} documentId - Document ID
     * @param {number} userId - User ID
     * @param {string} newTextContent - New text content
     * @param {Object} metadata - Updated metadata
     */
    static async updateDocumentChunks(documentId, userId, newTextContent, metadata) {
        try {
            // Delete existing chunks
            await this.deleteDocumentChunks(documentId, userId);
            
            // Store new chunks
            const vectorIds = await this.storeDocumentChunks(newTextContent, {
                ...metadata,
                document_id: documentId,
                user_id: userId
            });

            return vectorIds;

        } catch (error) {
            console.error('Error updating document chunks:', error);
            throw error;
        }
    }

    /**
     * Search across all user documents
     * @param {string} query - Search query
     * @param {number} userId - User ID
     * @param {Object} filters - Additional filters (category, doc_type, tags)
     * @param {number} limit - Number of results
     * @returns {Array} Search results
     */
    static async searchUserDocuments(query, userId, filters = {}, limit = 10) {
        try {
            const queryEmbedding = await OpenAIEmbeddingService.generateEmbedding(query);
            return this.searchUserDocumentsByEmbedding(queryEmbedding, userId, filters, limit);

        } catch (error) {
            console.error('Error searching user documents:', error);
            return [];
        }
    }

    /**
     * Search user documents with a precomputed query embedding.
     * Property-aware callers should resolve property scope through MySQL first and pass
     * the allowed document IDs here; the required user_id filter is always applied.
     */
    static async searchUserDocumentsByEmbedding(queryEmbedding, userId, filters = {}, limit = 10) {
        try {
            const requestedDocumentIds = filters.documentIds || filters.document_ids;
            if (Array.isArray(requestedDocumentIds) && this.normalizeIdList(requestedDocumentIds).length === 0) {
                return [];
            }

            const searchResult = await qdrantClient.search(
                env.qdrant.userDocumentsCollection,
                {
                    vector: queryEmbedding,
                    limit: limit,
                    with_payload: true,
                    filter: this.buildUserDocumentFilter(userId, filters)
                }
            );

            return this.formatSearchResults(searchResult);

        } catch (error) {
            console.error('Error searching user documents by embedding:', error);
            return [];
        }
    }
}

module.exports = UserDocumentVectorService;
