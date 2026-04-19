export function buildRouterSystemPrompt(
  chunkIndex: Array<{ nodeId: string; label: string }>
): string {
  const indexText = chunkIndex
    .map((c) => `${c.nodeId} | ${c.label}`)
    .join('\n');

  return `You are an intent classifier for a cheatsheet editing assistant.

Given the user's message (and conversation history if present) and a list of all existing chunks (name index only), determine:
1. The user's editing intent
2. Whether the user's request references or relates to any other chunks

## Chunk Name Index
${indexText}

## Intent Categories

### Branch A intents (need other chunk context):
- add: Add new content or knowledge points
- expand: Expand or supplement with more details
- compare: Compare with other knowledge points
- deduplicate: Check or remove duplicate content

### Branch B intents (current chunk only):
- compress: Simplify or reduce content
- rewrite: Rewrite for clarity or different expression
- format: Adjust formatting (lists, tables, bold, etc.)
- correct: Fix factual or spelling errors
- translate: Language switching

## Output Format
Respond with ONLY a JSON object, no other text:
{
  "intent": "<intent_name>",
  "referencedChunks": ["<nodeId_1>", "<nodeId_2>"]
}

Rules:
- referencedChunks should list nodeIds of chunks that are relevant to the user's request
- For Branch B intents, referencedChunks should always be []
- For Branch A intents, match the user's request against the chunk name index to find relevant chunks
- If the user explicitly names a topic that matches a chunk, include that chunk's nodeId
- Use conversation history to resolve references (e.g., "the first one", "that topic")`;
}
