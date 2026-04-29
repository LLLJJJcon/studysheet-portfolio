import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const CONVERTED_DIR = 'converted';

/**
 * Convert a file (PPT/PPTX/DOC/DOCX) to PDF using LibreOffice headless.
 * Returns the path to the cached PDF, or null on failure.
 */
// Service for converting Office documents to PDF using LibreOffice headless
export const fileConversionService = {
  /**
   * Get the path to the converted PDF for a given source file.
   * Converts on first request, caches for subsequent requests.
   */
  // Get or create a cached PDF conversion of the source file
  async getPdfPath(sourceFilePath: string): Promise<string | null> {
    const dir = path.dirname(sourceFilePath);
    const convertedDir = path.join(dir, CONVERTED_DIR);
    const baseName = path.basename(sourceFilePath, path.extname(sourceFilePath));
    const pdfPath = path.join(convertedDir, `${baseName}.pdf`);

    // Return cached version if it exists
    if (fs.existsSync(pdfPath)) {
      return pdfPath;
    }

    // Ensure converted directory exists
    if (!fs.existsSync(convertedDir)) {
      fs.mkdirSync(convertedDir, { recursive: true });
    }

    // Convert using LibreOffice headless
    try {
      await this.convertWithLibreOffice(sourceFilePath, convertedDir);
      if (fs.existsSync(pdfPath)) {
        return pdfPath;
      }
      console.error('LibreOffice conversion produced no output:', pdfPath);
      return null;
    } catch (error) {
      console.error('LibreOffice conversion failed:', error);
      return null;
    }
  },

  // Run LibreOffice headless to convert a file to PDF
  convertWithLibreOffice(inputPath: string, outDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        'libreoffice',
        ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', outDir, inputPath],
        { timeout: 60000 },
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(`LibreOffice error: ${error.message}\n${stderr}`));
          } else {
            resolve();
          }
        }
      );
    });
  },

  /** Check if a mimeType is convertible to PDF */
  // Check whether a MIME type can be converted to PDF
  isConvertible(mimeType: string): boolean {
    return [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ].includes(mimeType);
  },
};
