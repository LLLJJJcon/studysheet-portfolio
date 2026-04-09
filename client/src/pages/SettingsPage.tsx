import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/authApi';

export function SettingsPage() {
  const { user, fetchUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [preferredProvider, setPreferredProvider] = useState<'openai' | 'anthropic'>('openai');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setPreferredProvider(user.preferredProvider);
    }
  }, [user]);

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const update: { openai?: string | null; anthropic?: string | null } = {};
      if (openaiKey) update.openai = openaiKey;
      if (anthropicKey) update.anthropic = anthropicKey;

      if (Object.keys(update).length > 0) {
        await authApi.updateApiKeys(update);
      }
      await authApi.updateSettings({ preferredProvider });
      await fetchUser();
      setMessage('Settings saved successfully');
      setOpenaiKey('');
      setAnthropicKey('');
    } catch {
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <button
            onClick={() => navigate('/courses')}
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Courses
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <p className="text-gray-600 text-sm">Email: {user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-4 text-red-600 hover:underline text-sm"
          >
            Log out
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">LLM API Keys</h2>

          {message && (
            <div className={`p-3 rounded-md text-sm mb-4 ${message.includes('success') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSaveKeys} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OpenAI API Key {user?.apiKeys.openai && <span className="text-green-600">(configured)</span>}
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new key to update"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anthropic API Key {user?.apiKeys.anthropic && <span className="text-green-600">(configured)</span>}
              </label>
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new key to update"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Provider
              </label>
              <select
                value={preferredProvider}
                onChange={(e) => setPreferredProvider(e.target.value as 'openai' | 'anthropic')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
