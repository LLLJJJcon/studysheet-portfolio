import api from './api';

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
  updateApiKeys(apiKeys: { openai?: string | null; anthropic?: string | null }) {
    return api.put('/auth/api-keys', apiKeys);
  },
  updateSettings(settings: { preferredProvider?: string }) {
    return api.put('/auth/settings', settings);
  },
};
