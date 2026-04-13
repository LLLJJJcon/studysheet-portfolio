import { Layout, ILayout } from '../models/Layout';
import { Chunk } from '../models/Chunk';
import { ContentTree, ITreeNode } from '../models/ContentTree';
import { Course } from '../models/Course';

interface ExportOptions {
  format: 'html' | 'pdf';
  courseId: string;
}

/**
 * Generate an HTML export of the cheatsheet with CSS print styles.
 */
export const exportService = {
  async generateHTML(courseId: string): Promise<string> {
    const [course, layout, chunks, contentTree] = await Promise.all([
      Course.findById(courseId),
      Layout.findOne({ courseId }),
      Chunk.find({ courseId }).lean(),
      ContentTree.findOne({ courseId }),
    ]);

    if (!course || !layout || !contentTree) {
      throw new Error('Course data not found. Generate content first.');
    }

    const chunkMap = new Map(chunks.map((c) => [c.nodeId, c]));
    const pageConfig = course.pageConfig || { width: 210, height: 297, pages: 1 };

    const pagesHTML = generatePagesHTML(layout, chunkMap, pageConfig);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(course.name)} - StudySheet</title>
  <style>
    ${getPrintCSS(pageConfig, layout.fontSize, layout.lineHeight)}
  </style>
</head>
<body>
  ${pagesHTML}
</body>
</html>`;
  },

  async generatePDF(courseId: string): Promise<Buffer> {
    const html = await this.generateHTML(courseId);

    const course = await Course.findById(courseId);
    const pageConfig = course?.pageConfig || { width: 210, height: 297 };

    // Puppeteer lazy import for optional dependency
    let puppeteer;
    try {
      puppeteer = await import('puppeteer');
    } catch {
      throw new Error(
        'PDF generation requires puppeteer. Install it with: npm install puppeteer'
      );
    }

    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        width: `${pageConfig.width}mm`,
        height: `${pageConfig.height}mm`,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  },
};

function generatePagesHTML(
  layout: ILayout,
  chunkMap: Map<string, { content: string; importance: string }>,
  pageConfig: { width: number; height: number; pages: number }
): string {
  const pages: string[] = [];

  for (let pageIndex = 0; pageIndex < pageConfig.pages; pageIndex++) {
    const pageContainers = layout.containers.filter(
      (c) => c.page === pageIndex
    );

    let chunksHTML = '';

    for (const container of pageContainers) {
      for (const chunkPos of container.chunks || []) {
        const chunkData = chunkMap.get(chunkPos.nodeId);
        if (!chunkData) continue;

        const importanceClass = getImportanceClass(chunkData.importance);

        chunksHTML += `
        <div class="chunk ${importanceClass}" style="
          left: ${chunkPos.x}mm;
          top: ${chunkPos.y}mm;
          width: ${chunkPos.width}mm;
          height: ${chunkPos.height}mm;
        ">
          <div class="chunk-content">${escapeHtml(chunkData.content)}</div>
        </div>`;
      }
    }

    pages.push(`
      <div class="page" id="page-${pageIndex + 1}">
        ${chunksHTML}
      </div>`);
  }

  return pages.join('\n');
}

function getPrintCSS(
  pageConfig: { width: number; height: number },
  fontSize: number,
  lineHeight: number
): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @page {
      size: ${pageConfig.width}mm ${pageConfig.height}mm;
      margin: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
      font-size: ${fontSize}pt;
      line-height: ${lineHeight};
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      position: relative;
      width: ${pageConfig.width}mm;
      height: ${pageConfig.height}mm;
      page-break-after: always;
      overflow: hidden;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .chunk {
      position: absolute;
      border: 0.3pt solid #d1d5db;
      border-radius: 1pt;
      padding: 1mm;
      overflow: hidden;
    }

    .chunk-content {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .chunk.high-frequency {
      border-color: #fca5a5;
      background-color: #fef2f2;
    }

    .chunk.important {
      border-color: #93c5fd;
      background-color: #eff6ff;
    }

    .chunk.awareness {
      border-color: #d1d5db;
      background-color: #f9fafb;
    }

    @media screen {
      body {
        background: #e5e7eb;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 20px;
      }

      .page {
        background: white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
    }

    @media print {
      body {
        background: white;
      }
    }
  `;
}

function getImportanceClass(importance: string): string {
  switch (importance) {
    case 'High-Frequency':
      return 'high-frequency';
    case 'Important':
      return 'important';
    case 'Awareness':
      return 'awareness';
    default:
      return 'important';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
