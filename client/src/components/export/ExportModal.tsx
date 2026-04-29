import React, { useState, useCallback } from 'react';
import api from '../../services/api';

interface ExportModalProps {
  courseId: string;
  courseName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Render the export modal with HTML and PDF format selection and download
export const ExportModal: React.FC<ExportModalProps> = ({
  courseId,
  courseName,
  isOpen,
  onClose,
}) => {
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(
    async (format: 'html' | 'pdf') => {
      setExporting(format);
      setError(null);

      try {
        const response = await api.get(`/courses/${courseId}/export/${format}`, {
          responseType: 'blob',
        });

        const blob = new Blob([response.data], {
          type: format === 'html' ? 'text/html' : 'application/pdf',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${courseName}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onClose();
      } catch {
        setError(`Export${format.toUpperCase()}Failed. Please retry`);
      } finally {
        setExporting(null);
      }
    },
    [courseId, courseName, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-800">Export cheat sheet</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Export options */}
        <div className="p-5 space-y-3">
          {/* HTML export */}
          <button
            onClick={() => handleExport('html')}
            disabled={exporting !== null}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left disabled:opacity-50"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 text-orange-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">HTML File</div>
              <div className="text-xs text-gray-500">Ready to print, Keep original style</div>
            </div>
            {exporting === 'html' && (
              <svg className="w-4 h-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </button>

          {/* PDF export */}
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left disabled:opacity-50"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 text-red-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">PDF File</div>
              <div className="text-xs text-gray-500">High-quality export, Suitable for sharing</div>
            </div>
            {exporting === 'pdf' && (
              <svg className="w-4 h-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-5 pb-4">
            <div className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
