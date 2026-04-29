import { ChatMessage } from '../LLMProvider';

// Build a prompt for merging supplementary content into an existing chunk
export function buildMergeChunkContentPrompt(
  existingContent: string,
  newContent: string,
  nodeName: string,
  importance: string
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert exam preparation content editor.

Your task: Merge supplementary content into existing content for the exam point "${nodeName}" (importance: ${importance}).

Rules:
- The EXISTING content is the PRIMARY source — preserve its structure, wording, and coverage
- Integrate genuinely new information from the supplementary content
- Do NOT duplicate information already covered in existing content
- Maintain content density appropriate to the importance level:
  - High-Frequency: comprehensive coverage
  - Important: core concepts and key steps
  - Awareness: keywords and conclusions only
- Output ONLY the merged text. No explanations, no markers, no JSON wrapper.`,
    },
    {
      role: 'user',
      content: `Existing content:\n"""\n${existingContent}\n"""\n\nSupplementary content:\n"""\n${newContent}\n"""`,
    },
  ];
}
