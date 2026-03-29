const OpenAI = require('openai');
const env = require('../config/env');

const openai = new OpenAI({
  apiKey: env.ai.OpenAIKey
});

const LLM_MODEL = process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';

class UserDocumentAnalysisService {
    /**
     * Analyze document content and extract metadata using AI
     * @param {string} textContent - Extracted text from document
     * @param {string} filename - Original filename
     * @param {string} fileType - File extension
     * @returns {Object} Extracted metadata
     */
    static async analyzeDocument(textContent, filename, fileType) {
        try {
            const prompt = this.buildAnalysisPrompt(textContent, filename, fileType);
            
            const response = await openai.chat.completions.create({
                model: LLM_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are an expert document analyzer. Extract metadata from property-related documents with high accuracy. Always respond with valid JSON format."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
                top_p: 0.9,
                max_tokens: 4096
            });

            const analysisResult = this.parseAnalysisResponse(response.choices[0].message.content);
            return this.validateAndFormatResult(analysisResult, filename, fileType);

        } catch (error) {
            console.error("Document analysis error:", error);
            return this.getDefaultAnalysis(filename, fileType);
        }
    }

    /**
     * Build the analysis prompt for AI
     */
    static buildAnalysisPrompt(textContent, filename, fileType) {
        const truncatedContent = textContent.substring(0, 3000); // Limit content for analysis
        
        return `Analyze this property-related document and extract the following information. Respond ONLY with valid JSON format:

Document filename: ${filename}
File type: ${fileType}
Content preview: ${truncatedContent}

Extract and return this JSON structure:
{
  "doc_type": "specific document type (e.g., 'Lease Agreement', 'Financial Statement', 'Title Deed', 'EPC Certificate', 'Property Survey Report', 'Mortgage in Principle Letter', 'Proof of Identity', 'Proof of Address')",
  "category": "one of: financial, legal, maintenance, compliance, surveys_reports, property_details",
  "status": "one of: ready, urgent, expiring, processing, error",
  "tags": ["array", "of", "relevant", "tags", "like", "tenant", "bank", "lease", "ownership", "epc", "energy", "survey", "mortgage", "utilities"],
  "date": "YYYY-MM-DD format if found in document, or null",
  "expiry_date": "YYYY-MM-DD format if found, or null",
  "confidence": "0.0 to 1.0 confidence score"
}

Rules:
- If it's a bank statement, doc_type should be "Financial Statement" and category should be "financial"
- If it's a tenancy/lease agreement, doc_type should be "Lease Agreement" and category should be "legal"
- If it's a title deed, doc_type should be "Title Deed" and category should be "legal"
- For urgent documents (expiring soon, overdue), set status to "urgent"
- For documents with expiry dates in the next 30 days, set status to "expiring"
- Extract dates in YYYY-MM-DD format only
- Be conservative with confidence scores
- If uncertain about any field, use null or the most likely value`;
    }

    /**
     * Parse AI response and extract JSON
     */
    static parseAnalysisResponse(response) {
        try {
            // Try to find JSON in the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // If no JSON found, try to parse the entire response
            return JSON.parse(response);
        } catch (error) {
            console.error("Error parsing AI response:", error);
            return null;
        }
    }

    /**
     * Validate and format the analysis result
     */
    static validateAndFormatResult(analysis, filename, fileType) {
        if (!analysis || typeof analysis !== 'object') {
            return this.getDefaultAnalysis(filename, fileType);
        }

        // Validate and set defaults
        const result = {
            doc_type: this.validateDocType(analysis.doc_type, filename),
            category: this.validateCategory(analysis.category),
            status: this.validateStatus(analysis.status),
            tags: this.validateTags(analysis.tags),
            date: this.validateDate(analysis.date),
            expiry_date: this.validateDate(analysis.expiry_date),
            confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
            ai_analysis: analysis
        };

        // Auto-detect status based on expiry date
        if (result.expiry_date) {
            const expiryDate = new Date(result.expiry_date);
            const now = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) {
                result.status = "urgent"; // Overdue
            } else if (daysUntilExpiry <= 30) {
                result.status = "expiring";
            } else {
                result.status = "ready";
            }
        }

        return result;
    }

    /**
     * Validate document type
     */
    static validateDocType(docType, filename) {
        const validTypes = [
            "Lease Agreement", "Financial Statement", "Title Deed", 
            "EPC Certificate", "Property Survey Report", "Mortgage in Principle Letter",
            "Proof of Identity", "Proof of Address"
        ];

        if (validTypes.includes(docType)) {
            return docType;
        }

        // Fallback based on filename
        const lowerFilename = filename.toLowerCase();
        if (lowerFilename.includes('bank') || lowerFilename.includes('statement')) {
            return "Financial Statement";
        }
        if (lowerFilename.includes('lease') || lowerFilename.includes('tenancy')) {
            return "Lease Agreement";
        }
        if (lowerFilename.includes('title') || lowerFilename.includes('deed')) {
            return "Title Deed";
        }
        if (lowerFilename.includes('epc')) {
            return "EPC Certificate";
        }

        return "Document";
    }

    /**
     * Validate category
     */
    static validateCategory(category) {
        const validCategories = ["financial", "legal", "maintenance", "compliance", "surveys_reports", "property_details"];
        return validCategories.includes(category) ? category : "property_details";
    }

    /**
     * Validate status
     */
    static validateStatus(status) {
        const validStatuses = ["processing", "ready", "urgent", "expiring", "error"];
        return validStatuses.includes(status) ? status : "ready";
    }

    /**
     * Validate tags
     */
    static validateTags(tags) {
        if (!Array.isArray(tags)) {
            return [];
        }
        
        const validTags = ["tenant", "bank", "lease", "ownership", "epc", "energy", "survey", "mortgage", "utilities"];
        return tags.filter(tag => validTags.includes(tag.toLowerCase()));
    }

    /**
     * Validate date format
     */
    static validateDate(date) {
        if (!date) return null;
        
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return null;
        }
        
        return parsedDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }

    /**
     * Get default analysis when AI fails
     */
    static getDefaultAnalysis(filename, fileType) {
        const lowerFilename = filename.toLowerCase();
        
        let docType = "Document";
        let category = "property_details";
        let tags = [];

        if (lowerFilename.includes('bank') || lowerFilename.includes('statement')) {
            docType = "Financial Statement";
            category = "financial";
            tags = ["bank"];
        } else if (lowerFilename.includes('lease') || lowerFilename.includes('tenancy')) {
            docType = "Lease Agreement";
            category = "legal";
            tags = ["lease", "tenant"];
        } else if (lowerFilename.includes('title') || lowerFilename.includes('deed')) {
            docType = "Title Deed";
            category = "legal";
            tags = ["ownership"];
        }

        return {
            doc_type: docType,
            category: category,
            status: "ready",
            tags: tags,
            date: null,
            expiry_date: null,
            confidence: 0.3,
            ai_analysis: { error: "AI analysis failed, using defaults" }
        };
    }

    /**
     * Analyze document for individual chat context
     */
    static async analyzeForChat(textContent, question) {
        try {
            const prompt = `Based on this document content, answer the user's question. Be specific and cite relevant parts of the document.

Document content: ${textContent.substring(0, 2000)}
User question: ${question}

Provide a helpful, accurate answer based on the document content. If the information is not available in the document, say so clearly.`;

            const response = await openai.chat.completions.create({
                model: LLM_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that answers questions about property documents. Be accurate and cite specific information from the document when possible."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                top_p: 0.9,
                max_tokens: 4096
            });

            return response.choices[0].message.content;

        } catch (error) {
            console.error("Chat analysis error:", error);
            return "I'm sorry, I encountered an error while analyzing the document. Please try again.";
        }
    }
}

module.exports = UserDocumentAnalysisService;
