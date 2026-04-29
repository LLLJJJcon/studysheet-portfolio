import api from './api';

// Authentication API client for register, login, profile, and settings endpoints
export const authApi = {
  register(email: string, password: string) {
    return api.post('/auth/register', { email, password });
  },
  login(email: string, password: string) {
    return api.post('/auth/login', { email, password });
  },
  getMe() {
    return api.get('/auth/me');
  },
  updateApiKeys(apiKeys: { openai?: string | null; anthropic?: string | null; gemini?: string | null }) {
    return api.put('/auth/api-keys', apiKeys);
  },
  updateSettings(settings: { preferredProvider?: string; openaiBaseUrl?: string | null; preferredModel?: string | null }) {
    return api.put('/auth/settings', settings);
  },
};
