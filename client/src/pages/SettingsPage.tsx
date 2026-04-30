import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/authApi';

// Render the settings page for managing API keys, LLM provider, and account preferences
export function SettingsPage() {
  const { user, fetchUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [preferredProvider, setPreferredProvider] = useState<'openai' | 'anthropic' | 'gemini'>('openai');
  const [preferredModel, setPreferredModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    if (user) {
      setPreferredProvider(user.preferredProvider);
      setOpenaiBaseUrl(user.openaiBaseUrl || '');
      setPreferredModel(user.preferredModel || '');
    }
  }, [user]);

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');

    // --- JavaScript Form Validation ---
    if (openaiKey && openaiKey.length < 20) {
      setMessage('Invalid OpenAI key format. Key seems too short.');
      setMessageType('error');
      return;
    }
    if (anthropicKey && anthropicKey.length < 20) {
      setMessage('Invalid Anthropic key format. Key seems too short.');
      setMessageType('error');
      return;
    }
    if (geminiKey && geminiKey.length < 20) {
      setMessage('Invalid Gemini key format. Key seems too short.');
      setMessageType('error');
      return;
    }
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    if (openaiBaseUrl && !urlRegex.test(openaiBaseUrl)) {
      setMessage('Invalid OpenAI Base URL. Please enter a valid HTTP/HTTPS URL.');
      setMessageType('error');
      return;
    }

    setSaving(true);
    try {
      const update: { openai?: string | null; anthropic?: string | null; gemini?: string | null } = {};
      if (openaiKey) update.openai = openaiKey;
      if (anthropicKey) update.anthropic = anthropicKey;
      if (geminiKey) update.gemini = geminiKey;

      if (Object.keys(update).length > 0) {
        await authApi.updateApiKeys(update);
      }
      await authApi.updateSettings({
        preferredProvider,
        openaiBaseUrl: openaiBaseUrl || null,
        preferredModel: preferredModel || null,
      });
      await fetchUser();
      setMessage('Settings saved successfully');
      setMessageType('success');
      setOpenaiKey('');
      setAnthropicKey('');
      setGeminiKey('');
    } catch {
      setMessage('Save failed');
      setMessageType('error');
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
            ← Return to course list
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
            <div className={`p-3 rounded-md text-sm mb-4 ${messageType === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSaveKeys} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OpenAI API Key {user?.apiKeys.openai && <span className="text-green-600">(Configured)</span>}
              </label>
              {user?.apiKeys.openai && (
                <p className="text-xs text-gray-500 mb-1">Current: {user.apiKeys.openai}</p>
              )}
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
                OpenAI Base URL
                <span className="text-gray-400 font-normal ml-1">(Optional, for API compatibility)</span>
              </label>
              <input
                type="text"
                value={openaiBaseUrl}
                onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://api.openai.com/v1 (default)"
              />
              <p className="text-xs text-gray-400 mt-1">
                Support OpenAI-compatible APIs: MiniMax, GLM, Qwen, DeepSeek, etc.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anthropic API Key {user?.apiKeys.anthropic && <span className="text-green-600">(Configured)</span>}
              </label>
              {user?.apiKeys.anthropic && (
                <p className="text-xs text-gray-500 mb-1">Current: {user.apiKeys.anthropic}</p>
              )}
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
                Google Gemini API Key {user?.apiKeys.gemini && <span className="text-green-600">(Configured)</span>}
              </label>
              {user?.apiKeys.gemini && (
                <p className="text-xs text-gray-500 mb-1">Current: {user.apiKeys.gemini}</p>
              )}
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
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
                onChange={(e) => setPreferredProvider(e.target.value as 'openai' | 'anthropic' | 'gemini')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model Name
                <span className="text-gray-400 font-normal ml-1">(Leave blank to use default)</span>
              </label>
              <input
                type="text"
                value={preferredModel}
                onChange={(e) => setPreferredModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={preferredProvider === 'openai' ? 'gpt-4o' : preferredProvider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gemini-2.0-flash'}
              />
              <p className="text-xs text-gray-400 mt-1">
                e.g. gpt-4o, claude-sonnet-4-20250514, gemini-2.0-flash, deepseek-chat, glm-4-flash
              </p>
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
