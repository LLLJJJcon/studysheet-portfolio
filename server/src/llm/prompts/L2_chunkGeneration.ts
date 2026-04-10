import { ChatMessage } from '../LLMProvider';
import { ITreeNode } from '../../models/ContentTree';

const COMPLETENESS_RULES: Record<string, string> = {
  'High-Frequency':
    'Most complete: include definitions, principles, derivations, example problems, and formulas. Provide comprehensive coverage.',
  Important:
    'Moderately complete: include core concepts and key steps. Omit extended content and verbose explanations.',
  Awareness:
    'Concise: only retain keywords and core conclusions. Keep to minimum essential information.',
};

function serializeSubtree(node: ITreeNode, depth = 0): string {
  const indent = '  '.repeat(depth);
  let result = `${indent}- ${node.name}`;
  if (node.importance) {
    result += ` [${node.importance}]`;
  }
  result += ` (id: ${node.nodeId})`;
  result += '\n';

  if (node.children) {
    for (const child of node.children) {
      result += serializeSubtree(child, depth + 1);
    }
  }
  return result;
}

export function buildL2Prompt(
  courseName: string,
  sourceFileContent: string,
  subtree: ITreeNode
): ChatMessage[] {
  const subtreeText = serializeSubtree(subtree);
  const rulesText = Object.entries(COMPLETENESS_RULES)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: `You are an expert exam preparation content generator for the course "${courseName}".

Your task: For each LEAF node in the given subtree, generate chunk content appropriate to its importance level.

Content completeness rules by importance:
${rulesText}

For each leaf node, output a JSON object with:
- node_id: the exact node ID from the subtree
- content: the generated chunk content (plain text, can use markdown formatting)
- word_count: approximate word/character count of the content
- source_start: copy the EXACT first 30-50 characters from the source file that mark the START of the relevant passage you used to generate this chunk. Must be a verbatim substring of the source file.
- source_end: copy the EXACT last 30-50 characters from the source file that mark the END of the relevant passage. Must be a verbatim substring of the source file.

Output a JSON array of all leaf node chunks:
{"chunks": [{"node_id": "...", "content": "...", "word_count": 123, "source_start": "...", "source_end": "..."}, ...]}

Rules:
- Generate content ONLY for leaf nodes (nodes with importance labels)
- Content should be factual, exam-oriented, and information-dense
- Use the source file text as the primary reference
- source_start and source_end MUST be exact verbatim substrings from the source file content. They define the passage range you referenced.
- Output ONLY valid JSON. No markdown code blocks.`,
    },
    {
      role: 'user',
      content: `Subtree structure:\n${subtreeText}\n\nSource file content:\n${sourceFileContent}`,
    },
  ];
}
