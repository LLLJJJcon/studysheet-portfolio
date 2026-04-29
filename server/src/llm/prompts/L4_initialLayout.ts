import { ChatMessage } from '../LLMProvider';

interface ChunkInfo {
  nodeId: string;
  name: string;
  parentName: string;
  importance: string;
  wordCount: number;
  estimatedHeight: number; // mm
}

interface PageInfo {
  width: number;   // mm
  height: number;  // mm
  pages: number;
  margins: { top: number; right: number; bottom: number; left: number };
}

// Build the L4 prompt messages for generating initial page layout positions for chunks
export function buildL4Prompt(
  courseName: string,
  chunks: ChunkInfo[],
  pageInfo: PageInfo
): ChatMessage[] {
  const usableWidth = pageInfo.width - pageInfo.margins.left - pageInfo.margins.right;
  const usableHeight = pageInfo.height - pageInfo.margins.top - pageInfo.margins.bottom;

  const chunkList = chunks
    .map(
      (c) =>
        `- id: ${c.nodeId}, name: "${c.name}", parent: "${c.parentName}", importance: ${c.importance}, words: ${c.wordCount}, est_height: ${c.estimatedHeight}mm`
    )
    .join('\n');

  return [
    {
      role: 'system',
      content: `You are an expert layout engine for exam study sheets.

Course: "${courseName}"
Page dimensions: ${pageInfo.width}mm x ${pageInfo.height}mm
Margins: top=${pageInfo.margins.top}mm, right=${pageInfo.margins.right}mm, bottom=${pageInfo.margins.bottom}mm, left=${pageInfo.margins.left}mm
Usable area per page: ${usableWidth}mm x ${usableHeight}mm
Total pages: ${pageInfo.pages}

Your task: Assign each chunk to a position on the pages using abstract coordinates.

Layout rules:
1. Group related chunks (same parent) together in container boxes
2. High-Frequency items should be placed prominently (top-left area)
3. Awareness items can be placed in less prominent areas
4. No chunks may overlap
5. All chunks must fit within page boundaries
6. Leave small gaps (2mm) between chunks

Output a JSON object with this structure:
{
  "containers": [
    {
      "id": "container-uuid",
      "parentNodeId": "parent-node-id",
      "title": "Container Title",
      "page": 0,
      "x": 5,
      "y": 5,
      "width": 100,
      "height": 50,
      "chunks": [
        {
          "nodeId": "chunk-node-id",
          "x": 7,
          "y": 25,
          "width": 96,
          "height": 20
        }
      ]
    }
  ]
}

All coordinates are in mm from page top-left.
Container x,y is absolute on the page. Chunk x,y is also absolute on the page.
Output ONLY valid JSON.`,
    },
    {
      role: 'user',
      content: `Chunks to layout:\n${chunkList}`,
    },
  ];
}
