export interface UserInfo {
  _id: string;
  email: string;
  apiKeys: {
    openai: string | null;
    anthropic: string | null;
  };
  preferredProvider: 'openai' | 'anthropic';
  createdAt: string;
}
