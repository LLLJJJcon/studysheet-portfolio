import React, { useCallback, useState } from 'react';

interface FileUploaderProps {
  courseId: string;
  onUploadComplete: () => void;
}

export function FileUploader({ courseId, onUploadComplete }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState('');

  const uploadFiles = async (files: FileList) => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(`Uploading ${files.length} file(s)...`);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/courses/${courseId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setProgress('Upload successful!');
      onUploadComplete();
    } catch {
      setProgress('Upload failed,Please retry');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }, [courseId]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(e.target.files);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="text-gray-500">
        <p className="text-lg mb-2">Drag file here</p>
        <p className="text-sm mb-4">Or</p>
        <label className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
          Browse file
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt"
            onChange={handleFileInput}
            className="hidden"
            disabled={uploading}
          />
        </label>
        <p className="text-xs text-gray-400 mt-3">
          Support: PDF, Word, PPT, Image, Text
        </p>
      </div>

      {progress && (
        <p className={`mt-4 text-sm ${uploading ? 'text-blue-600' : progress.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
          {progress}
        </p>
      )}
    </div>
  );
}
