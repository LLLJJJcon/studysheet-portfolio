export interface RetrieverChunkInput {
  nodeId: string;
  name: string;
  content: string;
}

export function buildRetrieverSystemPrompt(
  chunkName: string,
  currentContent: string,
  referencedChunks: RetrieverChunkInput[]
): string {
  const refSection = referencedChunks
    .map(
      (c) => `### ${c.name} (nodeId: ${c.nodeId})\n"""\n${c.content}\n"""`
    )
    .join('\n\n');

  return `You are a duplicate content detector for a cheatsheet editing assistant.

The user wants to edit a chunk and their request may overlap with existing chunks.
Read the referenced chunks below and determine:
1. Whether the content the user wants to add/modify already exists (is duplicated)
2. Extract the relevant excerpt from each chunk

## User's Current Chunk
- Name: ${chunkName}
- Content:
"""
${currentContent}
"""

## Referenced Chunks
${refSection}

## Output Format
Respond with ONLY a JSON object, no other text:
{
  "hasDuplicates": true/false,
  "chunks": [
    {
      "nodeId": "<nodeId>",
      "name": "<chunk_name>",
      "isDuplicate": true/false,
      "relevantExcerpt": "<the specific part related to user's request, max 200 chars>",
      "reason": "<brief explanation of why this is/isn't a duplicate>"
    }
  ]
}

Rules:
- isDuplicate = true only when the referenced chunk already contains substantially the same content the user wants to add
- relevantExcerpt should be the specific passage from the referenced chunk that overlaps with the user's request
- Always include all referenced chunks in the output, even if they are not duplicates`;
}
