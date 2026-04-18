import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execFileAsync = promisify(execFile);

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
      const text = data.text.trim();
      if (text.length > 10) {
        return text;
      }
      // Text layer is empty/minimal — try OCR
      console.log('PDF text layer empty, falling back to OCR...');
      return this.ocrPdf(filePath, data.numpages);
    } catch (error) {
      console.error('PDF parse error:', error);
      return '[Failed to parse PDF]';
    }
  },

  async ocrPdf(filePath: string, numPages?: number): Promise<string> {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ocr-'));
    try {
      const pageCount = numPages || 1;
      const prefix = path.join(tmpDir, 'page');
      // Convert PDF pages to images
      await execFileAsync('pdftoppm', ['-png', '-r', '200', filePath, prefix]);

      const files = (await fs.promises.readdir(tmpDir))
        .filter(f => f.endsWith('.png'))
        .sort();

      const texts: string[] = [];
      for (const file of files) {
        const imgPath = path.join(tmpDir, file);
        const outBase = imgPath.replace('.png', '');
        await execFileAsync('tesseract', [imgPath, outBase, '-l', 'chi_sim+eng']);
        const txt = await fs.promises.readFile(outBase + '.txt', 'utf-8');
        texts.push(txt.trim());
      }

      const result = texts.join('\n\n');
      if (result.length > 10) {
        console.log(`OCR extracted ${result.length} chars from ${files.length} pages`);
        return result;
      }
      return '[PDF appears to be blank or unreadable]';
    } catch (error) {
      console.error('OCR fallback error:', error);
      return '[Failed to extract text via OCR]';
    } finally {
      // Cleanup temp files
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
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

  async parseImage(filePath: string): Promise<string> {
    try {
      const outBase = filePath + '_ocr';
      await execFileAsync('tesseract', [filePath, outBase, '-l', 'chi_sim+eng']);
      const txt = await fs.promises.readFile(outBase + '.txt', 'utf-8');
      await fs.promises.unlink(outBase + '.txt').catch(() => {});
      const result = txt.trim();
      if (result.length > 10) {
        return result;
      }
      return '[Image appears to be blank or unreadable]';
    } catch (error) {
      console.error('Image OCR error:', error);
      return '[Failed to extract text from image]';
    }
  },
};
