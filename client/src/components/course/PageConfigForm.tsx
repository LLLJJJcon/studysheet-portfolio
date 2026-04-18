import React, { useState } from 'react';

interface PageConfigFormProps {
  onSubmit: (config: { size: string; width: number; height: number; pages: number; columns?: number; fontSize?: number }) => void;
  onCancel: () => void;
}

const PRESETS = {
  A4: { width: 210, height: 297 },
  '16:9': { width: 338, height: 190 },
};

export function PageConfigForm({ onSubmit, onCancel }: PageConfigFormProps) {
  const [size, setSize] = useState<'A4' | '16:9' | 'custom'>('A4');
  const [width, setWidth] = useState(210);
  const [height, setHeight] = useState(297);
  const [pages, setPages] = useState(1);
  const [columns, setColumns] = useState(0); // 0 = auto
  const [fontSize, setFontSize] = useState(0); // 0 = auto

  const handleSizeChange = (newSize: 'A4' | '16:9' | 'custom') => {
    setSize(newSize);
    if (newSize in PRESETS) {
      const preset = PRESETS[newSize as keyof typeof PRESETS];
      setWidth(preset.width);
      setHeight(preset.height);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      size, width, height, pages,
      ...(columns > 0 ? { columns } : {}),
      ...(fontSize > 0 ? { fontSize } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Page size</label>
        <div className="flex gap-2">
          {(['A4', '16:9', 'custom'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSizeChange(s)}
              className={`px-4 py-2 rounded-md text-sm ${
                size === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s === 'custom' ? 'Custom' : s}
            </button>
          ))}
        </div>
      </div>

      {size === 'custom' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Width (mm)</label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              min={50}
              max={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Height (mm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              min={50}
              max={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Number of pages</label>
        <input
          type="number"
          value={pages}
          onChange={(e) => setPages(Number(e.target.value))}
          min={1}
          max={20}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Number of columns</label>
          <select
            value={columns}
            onChange={(e) => setColumns(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value={0}>Auto</option>
            <option value={1}>1 Column</option>
            <option value={2}>2 Column</option>
            <option value={3}>3 Column</option>
            <option value={4}>4 Column</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Font size</label>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value={0}>Auto</option>
            <option value={6}>6pt (Extra small)</option>
            <option value={7}>7pt (Compact)</option>
            <option value={8}>8pt (Moderate)</option>
            <option value={9}>9pt</option>
            <option value={10}>10pt (Standard)</option>
            <option value={12}>12pt (Large)</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Return
        </button>
      </div>
    </form>
  );
}
