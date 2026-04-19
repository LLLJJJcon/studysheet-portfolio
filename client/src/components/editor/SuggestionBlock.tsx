import React, { useState } from 'react';

interface SuggestionBlockProps {
  content: string;
  applied: boolean;
  onApply: () => void;
  onCopy: () => void;
}

export const SuggestionBlock: React.FC<SuggestionBlockProps> = ({
  content,
  applied,
  onApply,
  onCopy,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2 border border-green-300 rounded-md bg-green-50 overflow-hidden">
      <pre className="p-3 text-xs text-gray-800 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
        {content}
      </pre>
      <div className="flex justify-end gap-2 px-3 py-2 bg-green-100/50 border-t border-green-200">
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {applied ? (
          <span className="px-3 py-1 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded cursor-default">
            Applied ✓
          </span>
        ) : (
          <button
            onClick={onApply}
            className="px-3 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
};
