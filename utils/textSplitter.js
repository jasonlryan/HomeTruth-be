const { v4: uuidv4 } = require('uuid');

class TextSplitter {
  static splitText(text, chunkSize = 500, overlap = 50) {
    if (!text || text.length === 0) {
      return [];
    }

    // Clean the text first
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    
    if (cleanedText.length <= chunkSize) {
      return [{
        id: uuidv4(),
        text: cleanedText
      }];
    }

    const chunks = [];
    let start = 0;

    while (start < cleanedText.length) {
      let end = start + chunkSize;
      
      // If this isn't the last chunk, try to break at a sentence boundary
      if (end < cleanedText.length) {
        const lastSentenceEnd = cleanedText.lastIndexOf('.', end);
        const lastQuestionEnd = cleanedText.lastIndexOf('?', end);
        const lastExclamationEnd = cleanedText.lastIndexOf('!', end);
        
        const lastBreak = Math.max(lastSentenceEnd, lastQuestionEnd, lastExclamationEnd);
        
        if (lastBreak > start + chunkSize * 0.5) {
          end = lastBreak + 1;
        }
      }

      const chunk = cleanedText.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push({
          id: uuidv4(),
          text: chunk
        });
      }

      // Move start position with overlap
      start = end - overlap;
      
      // Prevent infinite loop
      if (start >= cleanedText.length) {
        break;
      }
    }

    return chunks;
  }

  static splitBySentences(text, maxChunkSize = 500) {
    if (!text || text.length === 0) {
      return [];
    }

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;

      const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;
      
      if (potentialChunk.length <= maxChunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push({
            id: uuidv4(),
            text: currentChunk + '.'
          });
          currentChunk = trimmedSentence;
        } else {
          // If single sentence is too long, split it
          const subChunks = this.splitText(trimmedSentence, maxChunkSize, 50);
          chunks.push(...subChunks);
        }
      }
    }

    if (currentChunk) {
      chunks.push({
        id: uuidv4(),
        text: currentChunk + '.'
      });
    }

    return chunks;
  }

  static splitByParagraphs(text, maxChunkSize = 500) {
    if (!text || text.length === 0) {
      return [];
    }

    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const chunks = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (trimmedParagraph.length === 0) continue;

      const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + trimmedParagraph;
      
      if (potentialChunk.length <= maxChunkSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = trimmedParagraph;
        } else {
          // If single paragraph is too long, split it
          const subChunks = this.splitText(trimmedParagraph, maxChunkSize, 50);
          chunks.push(...subChunks);
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}

module.exports = TextSplitter;
