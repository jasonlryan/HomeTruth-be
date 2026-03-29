const axios = require('axios');
const env = require('../config/env');

class WebSearchService {
  constructor() {
    // Using SerpAPI for Google search results - better coverage and more reliable than Bing
    this.apiKey = env.webSearch?.serpApiKey || process.env.SERPAPI_KEY || env.webSearch?.bingApiKey || process.env.BING_SEARCH_API_KEY;
    this.baseUrl = 'https://serpapi.com/search';
    this.useSerpApi = !!(env.webSearch?.serpApiKey || process.env.SERPAPI_KEY);
  }

  /**
   * Rewrite user query for better web search results
   * @param {string} userMessage - Original user message
   * @returns {string} - Optimized search query
   */
  rewriteQuery(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    // Property-specific query enhancements
    if (lowerMessage.includes('stamp duty') || lowerMessage.includes('sdlt')) {
      return `${userMessage} UK government 2024 rates calculator`;
    }
    
    if (lowerMessage.includes('worth') || lowerMessage.includes('value') || lowerMessage.includes('price')) {
      return `${userMessage} UK property valuation Zoopla Rightmove`;
    }
    
    if (lowerMessage.includes('remortgage') || lowerMessage.includes('mortgage rate')) {
      return `${userMessage} UK mortgage rates 2024 Halifax Nationwide`;
    }
    
    if (lowerMessage.includes('first time buyer') || lowerMessage.includes('ftb')) {
      return `${userMessage} UK first time buyer help to buy`;
    }
    
    if (lowerMessage.includes('conveyancing') || lowerMessage.includes('solicitor')) {
      return `${userMessage} UK conveyancing process costs`;
    }
    
    if (lowerMessage.includes('survey') || lowerMessage.includes('inspection')) {
      return `${userMessage} UK property survey types costs RICS`;
    }
    
    // Default enhancement for UK property context
    return `${userMessage} UK property housing market`;
  }

  /**
   * Search the web for property-related information
   * @param {string} userMessage - User's original message
   * @param {number} maxResults - Maximum number of results to return
   * @returns {Object} - Search results with sources
   */
  async searchWeb(userMessage, maxResults = 5) {
    try {
      if (!this.apiKey) {
        console.warn('Web Search API key not configured (SERPAPI_KEY or BING_SEARCH_API_KEY)');
        return { sources: [], content: '', hasResults: false };
      }

      const searchQuery = this.rewriteQuery(userMessage);
      
      let results = [];
      
      if (this.useSerpApi) {
        // Use SerpAPI (Google search results)
        const response = await axios.get(this.baseUrl, {
          params: {
            q: searchQuery,
            api_key: this.apiKey,
            engine: 'google',
            location: 'United Kingdom',
            gl: 'uk',
            hl: 'en',
            num: maxResults
          }
        });

        results = response.data?.organic_results || [];
      } else {
        // Fallback to Bing Search API (deprecated, will be retired Aug 2025)
        const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
          params: {
            q: searchQuery,
            count: maxResults,
            mkt: 'en-GB', // UK market
            safeSearch: 'Moderate',
            textDecorations: false,
            textFormat: 'Raw'
          },
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'User-Agent': 'HomeTruth-Property-App/1.0'
          }
        });

        results = response.data.webPages?.value || [];
      }
      
      if (results.length === 0) {
        return { sources: [], content: '', hasResults: false };
      }

      // Process results into sources and content
      const sources = [];
      const contentPieces = [];
      
      results.forEach((result, index) => {
        const sourceNumber = index + 1;
        
        // Handle different API response formats
        let title, url, snippet;
        
        if (this.useSerpApi) {
          // SerpAPI format
          title = result.title || 'Untitled';
          url = result.link || '';
          snippet = result.snippet || '';
        } else {
          // Bing format
          title = result.name || 'Untitled';
          url = result.url || '';
          snippet = result.snippet || '';
        }
        
        // Add to sources list
        sources.push({
          number: sourceNumber,
          title: title,
          url: url
        });
        
        // Add to content with citation
        if (snippet) {
          contentPieces.push(`[${sourceNumber}] ${snippet}`);
        }
      });

      const content = contentPieces.join('\n\n');
      
      return {
        sources: sources,
        content: content,
        hasResults: true
      };

    } catch (error) {
      console.error('Web search error:', error.message);
      return { 
        sources: [], 
        content: '',
        hasResults: false,
        error: error.message
      };
    }
  }

  /**
   * Check if a query would benefit from web search
   * @param {string} userMessage - User's message
   * @returns {boolean} - Whether web search should be performed
   */
  shouldSearchWeb(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    // Keywords that indicate need for current/fresh information
    const webSearchKeywords = [
      'stamp duty', 'sdlt', 'current rate', 'latest rate',
      'worth', 'value', 'price', 'valuation', 'market value',
      'remortgage', 'mortgage rate', 'interest rate',
      'first time buyer', 'help to buy', 'lisa',
      'conveyancing', 'solicitor', 'legal fees',
      'survey', 'inspection', 'rics',
      'now', 'today', 'current', 'latest', 'recent',
      'should i', 'when should', 'is it worth',
      'good time', 'bad time', 'market conditions'
    ];
    
    return webSearchKeywords.some(keyword => lowerMessage.includes(keyword));
  }
}

module.exports = new WebSearchService();
