const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

class DocumentProcessor {
  static async processFile(filePath, filename) {
    const fileExt = path.extname(filename).toLowerCase();
    
    try {
      switch (fileExt) {
        case '.pdf':
          return await this.processPDF(filePath);
        case '.docx':
          return await this.processDOCX(filePath);
        case '.txt':
          return await this.processTXT(filePath);
        case '.jpg':
        case '.jpeg':
        case '.png':
          return await this.processImage(filePath);
        default:
          throw new Error(`Unsupported file type: ${fileExt}`);
      }
    } catch (error) {
      console.error(`Error processing file ${filename}:`, error);
      throw error;
    }
  }

  static async processPDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } catch (error) {
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  static async processDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      throw new Error(`Failed to process DOCX: ${error.message}`);
    }
  }

  static async processTXT(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to process TXT: ${error.message}`);
    }
  }

  static async processImage(filePath) {
    try {
      // For images, we can't extract text directly
      // Return a placeholder message indicating this is an image
      const filename = path.basename(filePath);
      return `[IMAGE FILE: ${filename}] - This is an image document. Text extraction is not available for image files. Please use PDF or DOCX files for text-based document analysis.`;
    } catch (error) {
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  static cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .trim();
  }
}

module.exports = DocumentProcessor;
