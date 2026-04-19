import { SuggestionItem } from '../stores/chunkChatStore';

export function parseSuggestion(content: string): {
  cleanContent: string;
  suggestion: SuggestionItem | null;
} {
  const regex = /<<<SUGGESTION>>>([\s\S]*?)<<<END_SUGGESTION>>>/;
  const match = regex.exec(content);
  if (!match) return { cleanContent: content, suggestion: null };
  const cleanContent = content.replace(regex, '').trim();
  return { cleanContent, suggestion: { content: match[1].trim(), applied: false } };
}
