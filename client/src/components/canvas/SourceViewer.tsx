import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { generationApi } from '../../services/generationApi';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SourceViewerProps {
  courseId: string;
  sourceFile: string;
  chunkContent: string;
  sourceStart?: string;
  sourceEnd?: string;
  onClose: () => void;
}

interface FileMeta {
  filename: string;
  content: string;
  mimeType?: string;
  fileId?: string;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({
  courseId,
  sourceFile,
  chunkContent,
  sourceStart,
  sourceEnd,
  onClose,
}) => {
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setMeta(null);
    generationApi.getSourceFile(courseId, sourceFile).then((data) => {
      if (data) setMeta(data as FileMeta);
      setLoading(false);
    });
  }, [courseId, sourceFile]);

  const isPdf = meta?.mimeType === 'application/pdf'
    || meta?.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    || meta?.mimeType === 'application/vnd.ms-powerpoint';

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {loading ? (
        <div className="p-12 text-center text-gray-400">加载中...</div>
      ) : !meta ? (
        <div className="p-12 text-center text-gray-400">无法加载源文件</div>
      ) : isPdf ? (
        <PdfViewer
          courseId={courseId}
          fileId={meta.fileId || sourceFile}
          filename={meta.filename}
          extractedText={meta.content}
          sourceStart={sourceStart}
          sourceEnd={sourceEnd}
          chunkContent={chunkContent}
          onClose={onClose}
        />
      ) : (
        <TextViewer
          filename={meta.filename}
          content={meta.content}
          sourceStart={sourceStart}
          sourceEnd={sourceEnd}
          chunkContent={chunkContent}
          onClose={onClose}
        />
      )}
    </div>
  );
};

// ========== PDF Viewer ==========

interface PdfViewerProps {
  courseId: string;
  fileId: string;
  filename: string;
  extractedText: string;
  sourceStart?: string;
  sourceEnd?: string;
  chunkContent: string;
  onClose: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
  courseId,
  fileId,
  filename,
  extractedText,
  sourceStart,
  sourceEnd,
  chunkContent,
  onClose,
}) => {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [targetPage, setTargetPage] = useState<number | null>(null);
  const [scale, setScale] = useState(0.8);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfFile, setPdfFile] = useState<{ url: string; httpHeaders: Record<string, string> } | null>(null);

  // Build PDF file source with auth headers
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setPdfFile({
      url: generationApi.getRawFileUrl(courseId, fileId),
      httpHeaders: { Authorization: `Bearer ${token}` },
    });
  }, [courseId, fileId]);

  // When PDF loads, find the target page from sourceStart/sourceEnd
  const onDocumentLoadSuccess = useCallback(async (pdf: { numPages: number }) => {
    setNumPages(pdf.numPages);

    // Build search strings from sourceStart/sourceEnd/chunkContent
    const searchStrings: string[] = [];
    if (sourceStart) searchStrings.push(sourceStart);
    if (sourceEnd && sourceEnd !== sourceStart) searchStrings.push(sourceEnd);

    if (searchStrings.length === 0 && !chunkContent) {
      setCurrentPage(1);
      return;
    }

    // Use pdfjs to extract text page by page
    try {
      const loadingTask = pdfjs.getDocument(pdfFile!);
      const doc = await loadingTask.promise;

      // Method 1: exact match with source anchors
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');

        for (const s of searchStrings) {
          if (pageText.includes(s)) {
            setTargetPage(i);
            setCurrentPage(i);
            return;
          }
        }
      }

      // Method 2: If extractedText has the anchor, use character position to estimate page
      if (sourceStart && extractedText) {
        const idx = extractedText.indexOf(sourceStart);
        if (idx !== -1) {
          const ratio = idx / extractedText.length;
          const estimatedPage = Math.max(1, Math.ceil(ratio * pdf.numPages));
          setTargetPage(estimatedPage);
          setCurrentPage(estimatedPage);
          return;
        }
      }

      // Fuzzy fallback: search for keywords from chunkContent
      if (chunkContent) {
        const keywords = chunkContent
          .replace(/[#*_`\[\]()]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 5);

        let bestPage = 1;
        let bestScore = 0;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .toLowerCase();

          const score = keywords.filter((kw) => pageText.includes(kw.toLowerCase())).length;
          if (score > bestScore) {
            bestScore = score;
            bestPage = i;
          }
        }

        if (bestScore >= 2) {
          setTargetPage(bestPage);
          setCurrentPage(bestPage);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to extract page text:', err);
    }

    setCurrentPage(1);
  }, [pdfFile, sourceStart, chunkContent]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(numPages, page)));
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">📄 {filename}</span>
          {targetPage && (
            <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
              引用位于第 {targetPage} 页
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Page navigation */}
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-xs text-gray-500 min-w-[60px] text-center">
            {currentPage} / {numPages || '…'}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>

          {/* Zoom controls */}
          <div className="border-l border-gray-200 pl-2 ml-1 flex items-center gap-1">
            <button onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} className="p-1 rounded hover:bg-gray-100 text-xs text-gray-500">−</button>
            <span className="text-xs text-gray-400 min-w-[36px] text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(3, s + 0.2))} className="p-1 rounded hover:bg-gray-100 text-xs text-gray-500">+</button>
          </div>

          {/* Jump to reference */}
          {targetPage && currentPage !== targetPage && (
            <button
              onClick={() => setCurrentPage(targetPage)}
              className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 ml-1"
            >
              跳转引用
            </button>
          )}

          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 ml-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 flex justify-center p-4">
        {pdfFile ? (
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="p-12 text-center text-gray-400">加载PDF中...</div>}
            error={<div className="p-12 text-center text-red-400">PDF加载失败</div>}
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        ) : (
          <div className="p-12 text-center text-gray-400">准备中...</div>
        )}
      </div>

      {/* Page thumbnails strip */}
      {numPages > 1 && (
        <div className="border-t border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0 bg-gray-50">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`flex-shrink-0 w-8 h-8 text-xs rounded border ${
                page === currentPage
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : page === targetPage
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

// ========== Text Viewer (fallback for non-PDF) ==========

interface TextViewerProps {
  filename: string;
  content: string;
  sourceStart?: string;
  sourceEnd?: string;
  chunkContent: string;
  onClose: () => void;
}

const TextViewer: React.FC<TextViewerProps> = ({
  filename,
  content,
  sourceStart,
  sourceEnd,
  chunkContent,
  onClose,
}) => {
  const highlightRange = useMemo<{ startLine: number; endLine: number } | null>(() => {
    if (!content) return null;

    if (sourceStart && sourceEnd) {
      const startIdx = content.indexOf(sourceStart);
      if (startIdx !== -1) {
        const endIdx = content.indexOf(sourceEnd, startIdx);
        if (endIdx !== -1) {
          const startLine = content.substring(0, startIdx).split('\n').length - 1;
          const endLine = content.substring(0, endIdx + sourceEnd.length).split('\n').length - 1;
          return { startLine, endLine };
        }
      }
      if (content.indexOf(sourceStart) !== -1) {
        const line = content.substring(0, content.indexOf(sourceStart)).split('\n').length - 1;
        return { startLine: Math.max(0, line - 1), endLine: line + 8 };
      }
    }

    if (!chunkContent) return null;
    const searchTerms = chunkContent.replace(/[#*_`\[\]()]/g, '').split(/\s+/).filter((t) => t.length > 3).slice(0, 5);
    if (searchTerms.length === 0) return null;

    const lines = content.split('\n');
    let bestLine = -1;
    let bestScore = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      let score = 0;
      for (const term of searchTerms) {
        if (line.includes(term.toLowerCase())) score++;
      }
      if (score > bestScore) { bestScore = score; bestLine = i; }
    }
    if (bestLine === -1 || bestScore < 2) return null;
    return { startLine: Math.max(0, bestLine - 2), endLine: bestLine + 5 };
  }, [content, chunkContent, sourceStart, sourceEnd]);

  useEffect(() => {
    if (highlightRange) {
      setTimeout(() => {
        const el = document.getElementById('source-highlight-line');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [highlightRange]);

  const lines = content?.split('\n') || [];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">📄 {filename}</span>
          {highlightRange && (
            <span className="text-xs text-blue-500">
              第 {highlightRange.startLine + 1}-{highlightRange.endLine + 1} 行
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5">
        <div className="relative">
          {lines.map((line, i) => {
            const inRange = highlightRange && i >= highlightRange.startLine && i <= highlightRange.endLine;
            const isFirst = highlightRange && i === highlightRange.startLine;
            return (
              <div
                key={i}
                id={isFirst ? 'source-highlight-line' : undefined}
                className={`flex ${inRange ? 'bg-yellow-50 border-l-2 border-yellow-400' : ''}`}
              >
                <span className="inline-block w-10 text-right pr-3 text-gray-400 select-none flex-shrink-0 border-r border-gray-100">
                  {i + 1}
                </span>
                <span className={`pl-3 whitespace-pre-wrap break-all flex-1 ${inRange ? 'text-gray-900' : ''}`}>{line || ' '}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
