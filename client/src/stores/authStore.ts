import { create } from 'zustand';
import { authApi } from '../services/authApi';
import { UserInfo } from '../types/user';

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  loading: boolean;
  showApiKeyModal: boolean;
  setToken: (token: string | null) => void;
  fetchUser: () => Promise<void>;
  logout: () => void;
  setShowApiKeyModal: (show: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  token: localStorage.getItem('token'),
  user: null,
  loading: false,
  showApiKeyModal: false,

  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },

  fetchUser: async () => {
    set({ loading: true });
    try {
      const { data } = await authApi.getMe();
      const user = data.user;
      set({ user, loading: false });

      // Show API key modal if no keys configured
      if (!user.apiKeys.openai && !user.apiKeys.anthropic && !user.apiKeys.gemini) {
        set({ showApiKeyModal: true });
      }
    } catch {
      set({ loading: false, token: null, user: null });
      localStorage.removeItem('token');
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },

  setShowApiKeyModal: (show) => set({ showApiKeyModal: show }),
}));
