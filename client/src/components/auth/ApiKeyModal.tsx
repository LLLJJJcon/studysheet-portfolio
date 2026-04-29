import React, { useState } from 'react';
import { authApi } from '../../services/authApi';
import { useAuthStore } from '../../stores/authStore';

const steps = [
  {
    title: 'Welcome to StudySheet!',
    description:
      'StudySheet transforms your course materials into beautifully formatted, single-page study sheets using AI.',
  },
  {
    title: 'How It Works',
    description:
      '1. Upload your course outline or notes\n2. AI generates a structured content tree\n3. Content is compressed and laid out on a single page\n4. Edit, customize, and export your study sheet',
  },
  {
    title: 'Set Up Your API Keys',
    description:
      'StudySheet uses your own LLM API keys. Your keys are encrypted at rest and never shared. Provide at least one key to get started.',
  },
];

// Render the onboarding and API key configuration modal for first-time users
export function ApiKeyModal() {
  const { showApiKeyModal, setShowApiKeyModal, fetchUser, user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'gemini'>(user?.preferredProvider as 'openai' | 'anthropic' | 'gemini' || 'gemini');
  const [modelName, setModelName] = useState(user?.preferredModel || '');
  const [baseUrl, setBaseUrl] = useState(user?.openaiBaseUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isFirstUse = user && !user.apiKeys.openai && !user.apiKeys.anthropic && !user.apiKeys.gemini;
  const isOnboarding = isFirstUse && step < 2;

  if (!showApiKeyModal) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeKey = provider === 'openai' ? openaiKey : provider === 'anthropic' ? anthropicKey : geminiKey;
    if (!activeKey) {
      setError('Please provide an API key for the selected provider');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await authApi.updateApiKeys({
        openai: openaiKey || null,
        anthropic: anthropicKey || null,
        gemini: geminiKey || null,
      });

      // Save provider, model, and base URL settings
      await authApi.updateSettings({
        preferredProvider: provider,
        preferredModel: modelName || null,
        openaiBaseUrl: baseUrl || null,
      });

      await fetchUser();
      setShowApiKeyModal(false);
      setStep(0);
    } catch {
      setError('Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setShowApiKeyModal(false);
    setStep(0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Step indicators for onboarding */}
        {isFirstUse && (
          <div className="flex items-center gap-2 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}

        <h2 className="text-xl font-bold mb-2">
          {isFirstUse ? steps[step].title : 'Set Up Your LLM API Keys'}
        </h2>
        <p className="text-gray-500 text-sm mb-4 whitespace-pre-line">
          {isFirstUse
            ? steps[step].description
            : 'StudySheet uses your own API keys to call LLMs. Provide at least one key to get started.'}
        </p>

        {/* Onboarding intro steps */}
        {isOnboarding && (
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              className={`px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 ${
                step === 0 ? 'invisible' : ''
              }`}
            >
              Back
            </button>
            <button
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Next
            </button>
          </div>
        )}

        {/* API Key form (shown on step 2 for onboarding, or always for non-onboarding) */}
        {!isOnboarding && (
          <>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">{error}</div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'openai' | 'anthropic' | 'gemini')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI / Compatible</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>

              {/* API Key - show only the selected provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {provider === 'openai' ? 'OpenAI API Key' : provider === 'anthropic' ? 'Anthropic API Key' : 'Google Gemini API Key'}
                </label>
                <input
                  type="password"
                  value={provider === 'openai' ? openaiKey : provider === 'anthropic' ? anthropicKey : geminiKey}
                  onChange={(e) => {
                    if (provider === 'openai') setOpenaiKey(e.target.value);
                    else if (provider === 'anthropic') setAnthropicKey(e.target.value);
                    else setGeminiKey(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={provider === 'openai' ? 'sk-...' : provider === 'anthropic' ? 'sk-ant-...' : 'AIza...'}
                />
              </div>

              {/* Base URL - only for OpenAI compatible */}
              {provider === 'openai' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Base URL <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.openai.com/v1 (default)"
                  />
                  <p className="text-xs text-gray-400 mt-1">For API proxies like AiHubMix, fill in their URL</p>
                </div>
              )}

              {/* Model Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model <span className="text-gray-400 font-normal">(optional, uses default if empty)</span>
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={provider === 'openai' ? 'gpt-4o' : provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gemini-2.0-flash'}
                />
              </div>
              <div className="flex gap-3 pt-2">
                {isFirstUse && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : isFirstUse ? 'Get Started' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                >
                  Later
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
