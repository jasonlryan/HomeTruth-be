const OpenAI = require('openai');
const env = require('../config/env');

const openai = new OpenAI({ 
  apiKey: env.ai.OpenAIKey
});

class MetadataSuggestionService {
  /**
   * Suggest metadata (category, tags, priority, source) based on content
   * @param {string} title - Document title
   * @param {string} content - Document content (can be truncated)
   * @returns {Object} - Suggested metadata
   */
  static async suggestMetadata(title, content) {
    try {
      // Truncate content if too long to save tokens
      const maxContentLength = 2000;
      const truncatedContent = content.length > maxContentLength 
        ? content.substring(0, maxContentLength) + '...' 
        : content;

      const prompt = `Based on the following document, suggest appropriate metadata for a UK property/homebuying knowledge base.

Title: ${title || 'Untitled'}

Content Preview:
${truncatedContent}

Please suggest:
1. Category: One of "Buying Process", "Legal", "Financial", "Property Types", "Surveys", "Mortgages", "Insurance", "Moving", "First-time Buyer", or another relevant category
2. Tags: 3-8 relevant tags (as a JSON array of strings). Common tags include: homebuying, mortgage, legal, first-time-buyer, uk, property, survey, costs, process, stamp-duty, conveyancing, etc.
3. Priority: One of "Low", "Normal", "High", or "Critical" based on importance
4. Source: Suggested source if applicable (e.g., "Government Website", "Legal Firm", "Internal", "Property Website")

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks, no explanation):
{
  "category": "category name here",
  "tags": ["tag1", "tag2", "tag3"],
  "priority": "Normal",
  "source": "suggested source here"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a metadata extraction assistant. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      const aiResponse = response.choices[0].message.content;
      
      // Parse the JSON response (it might have markdown code blocks)
      let jsonStr = aiResponse.trim();
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON object if there's extra text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const suggested = JSON.parse(jsonStr);

      // Validate and set defaults
      return {
        category: suggested.category || null,
        tags: Array.isArray(suggested.tags) ? suggested.tags : [],
        priority: ['Low', 'Normal', 'High', 'Critical'].includes(suggested.priority) 
          ? suggested.priority 
          : 'Normal',
        source: suggested.source || null
      };

    } catch (error) {
      console.error('Error suggesting metadata:', error);
      
      // Return safe defaults if AI fails
      return {
        category: null,
        tags: [],
        priority: 'Normal',
        source: null,
        error: 'Failed to generate metadata suggestions'
      };
    }
  }
}

module.exports = MetadataSuggestionService;

