import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface PrintPreviewProps {
  courseId: string;
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
}

// Render a full-screen print preview with the exported HTML loaded in an iframe
export const PrintPreview: React.FC<PrintPreviewProps> = ({
  courseId,
  isOpen,
  onClose,
  onExport,
}) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const response = await api.get(`/courses/${courseId}/export/html`, {
        responseType: 'text',
      });
      setHtmlContent(response.data);
    } catch {
      setHtmlContent('<p style="text-align:center;padding:2em;color:#999;">Preview failed to load</p>');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen, loadPreview]);

  const handlePrint = useCallback(() => {
    const iframe = document.getElementById('print-preview-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-800">Print preview</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Export file
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-6">
        {loading ? (
          <div className="text-gray-400 mt-20">Load preview...</div>
        ) : (
          <iframe
            id="print-preview-iframe"
            srcDoc={htmlContent}
            className="bg-white shadow-lg border border-gray-200"
            style={{ width: '210mm', minHeight: '297mm' }}
            title="Print Preview"
          />
        )}
      </div>
    </div>
  );
};
