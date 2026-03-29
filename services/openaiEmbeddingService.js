const OpenAI = require('openai');
const env = require('../config/env');

const openai = new OpenAI({ 
  apiKey: env.ai.OpenAIKey
});

class OpenAIEmbeddingService {
  /**
   * Generate embedding using OpenAI's embedding model
   * @param {string} text - Text to generate embedding for
   * @returns {Promise<Array<number>>} - Embedding vector
   */
  static async generateEmbedding(text) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small', // Fast, cheap, and high quality (1536 dimensions)
        input: text
      });
      
      if (!response || !response.data || !response.data[0] || !response.data[0].embedding) {
        throw new Error('OpenAI returned invalid embedding response');
      }
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Error generating OpenAI embedding:', error);
      
      // Provide more helpful error messages
      if (error.code === 'insufficient_quota' || error.message?.includes('quota')) {
        throw new Error('OpenAI API quota exceeded. Please check your billing.');
      }
      
      if (error.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key. Please check your configuration.');
      }
      
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   * @param {Array<string>} texts - Array of texts to generate embeddings for
   * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
   */
  static async generateEmbeddings(texts) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts
      });
      
      if (!response || !response.data) {
        throw new Error('OpenAI returned invalid batch embedding response');
      }
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('❌ Error generating batch OpenAI embeddings:', error);
      throw error;
    }
  }
}

module.exports = OpenAIEmbeddingService;

