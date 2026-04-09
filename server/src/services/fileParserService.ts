import fs from 'fs';
import path from 'path';

export const fileParserService = {
  async parseFile(filePath: string, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'text/plain':
        return fs.promises.readFile(filePath, 'utf-8');

      case 'application/pdf':
        return this.parsePdf(filePath);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return this.parseWord(filePath);

      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      case 'application/vnd.ms-powerpoint':
        return this.parsePpt(filePath);

      case 'image/png':
      case 'image/jpeg':
      case 'image/webp':
        return this.parseImage(filePath);

      default:
        return `[Unsupported file format: ${mimeType}]`;
    }
  },

  async parsePdf(filePath: string): Promise<string> {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = await fs.promises.readFile(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('PDF parse error:', error);
      return '[Failed to parse PDF]';
    }
  },

  async parseWord(filePath: string): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.error('Word parse error:', error);
      return '[Failed to parse Word document]';
    }
  },

  async parsePpt(filePath: string): Promise<string> {
    // Basic PPT parsing - extract text from slides
    try {
      const buffer = await fs.promises.readFile(filePath);
      // Simple text extraction from PPTX (XML-based)
      const text = buffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 100) {
        return text;
      }
      return '[PPT content extracted - install pptx-parser for better results]';
    } catch (error) {
      console.error('PPT parse error:', error);
      return '[Failed to parse PPT]';
    }
  },

  async parseImage(_filePath: string): Promise<string> {
    // OCR placeholder - tesseract.js is heavy, defer to future
    return '[Image uploaded - OCR processing not yet implemented]';
  },
};
