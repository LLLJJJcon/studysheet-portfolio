import React, { useState } from 'react';
import { PageConfigForm } from './PageConfigForm';
import api from '../../services/api';
import { Course } from '../../types/course';

interface CreateCourseModalProps {
  show: boolean;
  onClose: () => void;
  onCreated: (course: Course) => void;
}

export function CreateCourseModal({ show, onClose, onCreated }: CreateCourseModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  if (!show) return null;

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Course name is required');
      return;
    }
    setError('');
    setStep(2);
  };

  const handlePageConfig = async (config: { size: string; width: number; height: number; pages: number }) => {
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post('/courses', {
        name: name.trim(),
        pageConfig: config,
      });
      onCreated(data.course);
      // Reset
      setStep(1);
      setName('');
      onClose();
    } catch {
      setError('Failed to create course');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setName('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {step === 1 ? 'New Course' : 'Page Settings'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">{error}</div>
        )}

        {step === 1 ? (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Advanced Mathematics"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Next
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <PageConfigForm
            onSubmit={handlePageConfig}
            onCancel={() => setStep(1)}
          />
        )}

        {creating && (
          <div className="mt-4 text-center text-sm text-blue-600">Creating course...</div>
        )}
      </div>
    </div>
  );
}
