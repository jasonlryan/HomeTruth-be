const { qdrantClient, COLLECTION_NAME } = require('../config/qdrant');
const OpenAIEmbeddingService = require('./openaiEmbeddingService');

class VectorStore {
  static async storeDocuments(chunks, metadata) {
    try {
      const points = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await OpenAIEmbeddingService.generateEmbedding(chunk.text);
        
        const point = {
          id: chunk.id, // Use the UUID from the chunk
          vector: embedding,
          payload: {
            text: chunk.text,
            ...metadata,
            chunk_index: i,
            chunk_length: chunk.text.length
          }
        };
        
        points.push(point);
      }

      await qdrantClient.upsert(COLLECTION_NAME, {
        wait: true,
        points: points
      });

      console.log(`✅ Stored ${points.length} chunks for document: ${metadata.filename}`);
      return points.length;
    } catch (error) {
      console.error('❌ Error storing documents:', error);
      throw error;
    }
  }

  static formatSimilarChunkResults(searchResult) {
    return searchResult.map(result => ({
      id: result.id,
      text: result.payload.text,
      score: result.score,
      metadata: {
        filename: result.payload.filename,
        document_id: result.payload.document_id,
        chunk_index: result.payload.chunk_index,
        upload_date: result.payload.upload_date,
        title: result.payload.title,
        category: result.payload.category,
        tags: result.payload.tags,
        source: result.payload.source
      }
    }));
  }

  static async searchSimilarChunksByEmbedding(queryEmbedding, limit = 5, scoreThreshold = 0.7) {
    try {
      const searchResult = await qdrantClient.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: limit,
        with_payload: true,
        score_threshold: scoreThreshold
      });

      return this.formatSimilarChunkResults(searchResult);
    } catch (error) {
      console.error('❌ Error searching similar chunks:', error);
      throw error;
    }
  }

  static async searchSimilarChunks(query, limit = 5, scoreThreshold = 0.7) {
    try {
      const queryEmbedding = await OpenAIEmbeddingService.generateEmbedding(query);
      return this.searchSimilarChunksByEmbedding(queryEmbedding, limit, scoreThreshold);
    } catch (error) {
      console.error('❌ Error searching similar chunks:', error);
      throw error;
    }
  }

  static async searchKnowledgeBase(query, limit = 20, filters = {}) {
    try {
      const queryEmbedding = await OpenAIEmbeddingService.generateEmbedding(query);
      
      // Build filter if provided
      let filter = null;
      if (filters.category || filters.tags || filters.source) {
        filter = {
          must: []
        };
        
        if (filters.category) {
          filter.must.push({
            key: 'category',
            match: { value: filters.category }
          });
        }
        
        if (filters.tags && filters.tags.length > 0) {
          filter.must.push({
            key: 'tags',
            match: { any: filters.tags }
          });
        }
        
        if (filters.source) {
          filter.must.push({
            key: 'source',
            match: { value: filters.source }
          });
        }
      }

      const searchOptions = {
        vector: queryEmbedding,
        limit: limit,
        with_payload: true,
        score_threshold: 0.5
      };

      if (filter) {
        searchOptions.filter = filter;
      }

      const searchResult = await qdrantClient.search(COLLECTION_NAME, searchOptions);

      // Group results by document_id
      const documentMap = new Map();
      
      searchResult.forEach(result => {
        const docId = result.payload.document_id;
        if (!documentMap.has(docId)) {
          documentMap.set(docId, {
            document_id: docId,
            title: result.payload.title || result.payload.filename,
            filename: result.payload.filename,
            category: result.payload.category,
            tags: result.payload.tags || [],
            source: result.payload.source,
            upload_date: result.payload.upload_date,
            chunks: [],
            max_score: result.score
          });
        }
        
        const doc = documentMap.get(docId);
        doc.chunks.push({
          chunk_id: result.id,
          text: result.payload.text,
          score: result.score,
          chunk_index: result.payload.chunk_index
        });
        
        if (result.score > doc.max_score) {
          doc.max_score = result.score;
        }
      });

      // Convert to array and sort by relevance
      const results = Array.from(documentMap.values())
        .sort((a, b) => b.max_score - a.max_score);

      return {
        total_results: results.length,
        documents: results,
        query: query
      };
    } catch (error) {
      console.error('❌ Error searching knowledge base:', error);
      throw error;
    }
  }

  static async searchByUser(userId, limit = 5) {
    try {
      const searchResult = await qdrantClient.scroll(COLLECTION_NAME, {
        filter: {
          must: [
            {
              key: 'user_id',
              match: {
                value: parseInt(userId)
              }
            }
          ]
        },
        limit: limit,
        with_payload: true
      });

      return searchResult.points.map(point => ({
        id: point.id,
        text: point.payload.text,
        metadata: {
          filename: point.payload.filename,
          document_id: point.payload.document_id,
          chunk_index: point.payload.chunk_index,
          upload_date: point.payload.upload_date
        }
      }));
    } catch (error) {
      console.error('❌ Error searching by user:', error);
      throw error;
    }
  }

  static async deleteByDocument(documentId) {
    try {
      await qdrantClient.delete(COLLECTION_NAME, {
        wait: true,
        filter: {
          must: [
            {
              key: 'document_id',
              match: {
                value: documentId
              }
            }
          ]
        }
      });

      console.log(`✅ Deleted chunks for document: ${documentId}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting document chunks:', error);
      throw error;
    }
  }

  static async deleteByUser(userId) {
    try {
      await qdrantClient.delete(COLLECTION_NAME, {
        wait: true,
        filter: {
          must: [
            {
              key: 'user_id',
              match: {
                value: parseInt(userId)
              }
            }
          ]
        }
      });

      console.log(`✅ Deleted all chunks for user: ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting user chunks:', error);
      throw error;
    }
  }

  static async getCollectionInfo() {
    try {
      const info = await qdrantClient.getCollection(COLLECTION_NAME);
      return {
        name: info.collection_name,
        vectors_count: info.vectors_count,
        indexed_vectors_count: info.indexed_vectors_count,
        points_count: info.points_count,
        segments_count: info.segments_count,
        status: info.status,
        config: info.config
      };
    } catch (error) {
      console.error('❌ Error getting collection info:', error);
      throw error;
    }
  }

  static async getCollectionStats() {
    try {
      const info = await qdrantClient.getCollection(COLLECTION_NAME);
      
      // Get unique document count by scrolling through unique document_ids
      const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
        limit: 10000,
        with_payload: true
      });

      const uniqueDocuments = new Set();
      scrollResult.points.forEach(point => {
        if (point.payload.document_id) {
          uniqueDocuments.add(point.payload.document_id);
        }
      });

      return {
        total_vectors: info.points_count || 0,
        total_documents: uniqueDocuments.size,
        indexed_vectors: info.indexed_vectors_count || 0,
        segments_count: info.segments_count || 0,
        status: info.status
      };
    } catch (error) {
      console.error('❌ Error getting collection stats:', error);
      throw error;
    }
  }

  static async getNamespaceBreakdown() {
    try {
      // Get all points to analyze by entry method (using as namespace)
      const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
        limit: 100000, // Large limit to get all points
        with_payload: true
      });

      // Group by namespace (entry method)
      const namespaceCounts = {};
      let totalVectors = 0;

      scrollResult.points.forEach(point => {
        totalVectors++;
        
        // Determine namespace based on entry method in payload or url
        let namespace = 'general'; // default
        
        // If it has a URL, it's from URL scrape
        if (point.payload.url) {
          namespace = 'urls';
        } else if (point.payload.entry_method) {
          // Map entry methods to namespaces
          if (point.payload.entry_method === 'url_scrape') {
            namespace = 'urls';
          } else {
            namespace = 'general'; // file_upload, manual_entry
          }
        }

        namespaceCounts[namespace] = (namespaceCounts[namespace] || 0) + 1;
      });

      // Convert to array format for UI
      const namespaceBreakdown = Object.entries(namespaceCounts).map(([name, count]) => ({
        namespace: name,
        vector_count: count
      })).sort((a, b) => b.vector_count - a.vector_count);

      return {
        namespace_breakdown: namespaceBreakdown,
        total_vectors: totalVectors
      };
    } catch (error) {
      console.error('❌ Error getting namespace breakdown:', error);
      throw error;
    }
  }

  static async clearCollection() {
    try {
      await qdrantClient.delete(COLLECTION_NAME, {
        wait: true,
        filter: {}
      });

      console.log('✅ Collection cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing collection:', error);
      throw error;
    }
  }
}

module.exports = VectorStore;
