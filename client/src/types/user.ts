export interface UserInfo {
  _id: string;
  email: string;
  apiKeys: {
    openai: string | null;
    anthropic: string | null;
    gemini: string | null;
  };
  openaiBaseUrl: string | null;
  preferredProvider: 'openai' | 'anthropic' | 'gemini';
  preferredModel: string | null;
  createdAt: string;
}
