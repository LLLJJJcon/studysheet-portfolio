export interface GeneratorRelevantChunk {
  name: string;
  nodeId: string;
  isDuplicate: boolean;
  treePath: string;
  relevantExcerpt: string;
}

export interface GeneratorChunkContext {
  name: string;
  importance: string;
  treePath: string;
  content: string;
  wordCount: number;
  pageWordLimit: number;
}

export function buildGeneratorSystemPrompt(
  ctx: GeneratorChunkContext,
  relevantChunks?: GeneratorRelevantChunk[]
): string {
  let relevantSection = '';
  if (relevantChunks && relevantChunks.length > 0) {
    const entries = relevantChunks
      .map((c) => {
        const dupTag = c.isDuplicate ? ' [DUPLICATE]' : '';
        return `### ${c.name} (${c.treePath})${dupTag}\n"""\n${c.relevantExcerpt}\n"""`;
      })
      .join('\n\n');

    relevantSection = `
## Related Chunks (for reference)
The following chunks contain content related to the user's request:

${entries}
`;
  }

  return `You are a cheatsheet content editing assistant. You are helping the user edit a specific content chunk.

## Current Chunk
- Name: ${ctx.name}
- Importance: ${ctx.importance} (High-Frequency / Important / Awareness)
- Knowledge Path: ${ctx.treePath}
- Current Content:
"""
${ctx.content}
"""
- Current Word Count: ${ctx.wordCount}
- Page Word Limit: ${ctx.pageWordLimit}
${relevantSection}
## Output Rules
1. When the user requests content changes, include exactly ONE SUGGESTION block:
   <<<SUGGESTION>>>
   Complete replacement content for the chunk
   <<<END_SUGGESTION>>>
2. SUGGESTION must be complete replacement content (not a diff, not a partial fragment). Only one SUGGESTION block per response
3. Outside the SUGGESTION block, briefly explain what you changed and why (1-2 sentences)
4. If the user is only asking a question (not requesting changes), answer directly without a SUGGESTION block
5. Content should use Markdown format, suitable for compact cheatsheet display
6. Respect the word limit. When compressing, prioritize: High-Frequency > Important > Awareness
7. Do NOT use emojis in your responses
8. Respond in English
9. **Duplicate handling:** If any Related Chunk is marked [DUPLICATE], do NOT generate a SUGGESTION immediately. Instead, inform the user which chunk already covers this content, briefly describe what it contains, and ask how they would like to proceed (e.g., write from a different angle, add a brief reference, or skip). Only generate a SUGGESTION after the user confirms their preference in a follow-up message.`;
}
