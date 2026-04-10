import { ChatMessage } from '../LLMProvider';

const COMPRESSION_RULES: Record<string, string> = {
  Awareness:
    'Compress to a bare minimum. Retain only key terms and conclusions. Remove all explanations, examples, and derivations. Target: 30-40% of original length.',
  Important:
    'Compress moderately. Keep core concepts and key formulas. Remove verbose explanations and secondary examples. Target: 50-60% of original length.',
  'High-Frequency':
    'Compress lightly. Preserve most content but tighten language. Remove redundant phrasing and consolidate similar points. Target: 70-80% of original length.',
};

export function buildL3Prompt(
  importance: string,
  nodeId: string,
  nodeName: string,
  originalContent: string,
  targetReduction: number
): ChatMessage[] {
  const rule = COMPRESSION_RULES[importance] || COMPRESSION_RULES['Important'];

  return [
    {
      role: 'system',
      content: `You are an expert content compressor for exam study sheets.

Your task: Compress the given content while preserving the most important information according to the importance level.

Importance level: ${importance}
Compression rule: ${rule}

Target: reduce content by approximately ${Math.round(targetReduction * 100)}%.

Rules:
- Preserve key terminology, formulas, and definitions
- Use concise language and abbreviations where appropriate
- Maintain logical structure
- Output ONLY the compressed text, no explanations
- Do NOT add any prefix or wrapper`,
    },
    {
      role: 'user',
      content: `Node: ${nodeName} (ID: ${nodeId})\n\nOriginal content:\n${originalContent}`,
    },
  ];
}
