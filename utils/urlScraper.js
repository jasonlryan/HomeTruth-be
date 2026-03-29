const axios = require('axios');

class UrlScraper {
  /**
   * Scrape content from a URL
   * @param {string} url - URL to scrape
   * @returns {Object} - Object containing title and content
   */
  static async scrapeUrl(url) {
    try {
      // Validate URL
      if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL provided');
      }

      // Ensure URL has protocol
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }

      // Fetch the URL
      const response = await axios.get(formattedUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept 2xx and 3xx status codes
        }
      });

      const html = response.data;
      
      // Basic HTML parsing without external dependencies
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      let title = titleMatch ? titleMatch[1].trim() : 'Untitled Document';

      // Extract main content by removing scripts and styles
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '') // Remove noscript
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '') // Remove navigation
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '') // Remove header
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '') // Remove footer
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, ''); // Remove aside

      // Try to extract main/article content
      const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || 
                       content.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                       content.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

      if (mainMatch) {
        content = mainMatch[1];
      }

      // Strip HTML tags and decode entities
      content = content
        .replace(/<[^>]+>/g, ' ') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&[a-z]+;/gi, ' ') // Remove other entities
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // If content is too short, try extracting from body
      if (content.length < 200) {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          content = bodyMatch[1]
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }

      // Validate we got some content
      if (!content || content.length < 50) {
        throw new Error('Unable to extract meaningful content from URL');
      }

      // Limit content length to prevent extremely long documents
      if (content.length > 100000) {
        content = content.substring(0, 100000) + '... [Content truncated]';
      }

      return {
        title: title || 'Untitled Document',
        content: content,
        url: formattedUrl,
        success: true
      };

    } catch (error) {
      console.error('URL scraping error:', error.message);
      
      if (error.response) {
        throw new Error(`Failed to fetch URL: HTTP ${error.response.status}`);
      } else if (error.request) {
        throw new Error('Failed to fetch URL: No response from server');
      } else {
        throw new Error(`Failed to scrape URL: ${error.message}`);
      }
    }
  }

  /**
   * Validate if a string is a valid URL
   * @param {string} url - URL to validate
   * @returns {boolean} - Whether URL is valid
   */
  static isValidUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      try {
        const urlObj = new URL('https://' + url);
        return true;
      } catch {
        return false;
      }
    }
  }
}

module.exports = UrlScraper;

