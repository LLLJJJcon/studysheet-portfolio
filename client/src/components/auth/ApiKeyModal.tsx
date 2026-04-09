import React, { useState } from 'react';
import { authApi } from '../../services/authApi';
import { useAuthStore } from '../../stores/authStore';

export function ApiKeyModal() {
  const { showApiKeyModal, setShowApiKeyModal, fetchUser } = useAuthStore();
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!showApiKeyModal) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openaiKey && !anthropicKey) {
      setError('Please provide at least one API key');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await authApi.updateApiKeys({
        openai: openaiKey || null,
        anthropic: anthropicKey || null,
      });

      if (openaiKey && !anthropicKey) {
        await authApi.updateSettings({ preferredProvider: 'openai' });
      } else if (anthropicKey && !openaiKey) {
        await authApi.updateSettings({ preferredProvider: 'anthropic' });
      }

      await fetchUser();
      setShowApiKeyModal(false);
    } catch {
      setError('Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold mb-2">Set Up Your LLM API Keys</h2>
        <p className="text-gray-500 text-sm mb-4">
          StudySheet uses your own API keys to call LLMs. Provide at least one key to get started.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="openai-key" className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API Key
            </label>
            <input
              id="openai-key"
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label htmlFor="anthropic-key" className="block text-sm font-medium text-gray-700 mb-1">
              Anthropic API Key
            </label>
            <input
              id="anthropic-key"
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="sk-ant-..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowApiKeyModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Later
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
