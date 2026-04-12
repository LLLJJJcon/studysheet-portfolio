import { ChatMessage } from '../LLMProvider';

interface ChunkBBox {
  nodeId: string;
  name: string;
  importance: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isUserPositioned: boolean;
}

interface PageConfig {
  width: number;
  height: number;
  pages: number;
  margins: { top: number; right: number; bottom: number; left: number };
}

/**
 * L6 Layout Optimization prompt.
 * Given current chunk positions and sizes, the AI optimizes
 * the layout for better space utilization and readability.
 */
export function buildL6Prompt(
  chunkBBoxes: ChunkBBox[],
  pageConfig: PageConfig,
  fontSize: number
): ChatMessage[] {
  const userPositioned = chunkBBoxes.filter((c) => c.isUserPositioned);
  const autoPositioned = chunkBBoxes.filter((c) => !c.isUserPositioned);

  const bboxList = chunkBBoxes
    .map(
      (c) =>
        `  - ${c.nodeId} "${c.name}" [${c.importance}] page=${c.page} ` +
        `pos=(${c.x.toFixed(1)}, ${c.y.toFixed(1)}) ` +
        `size=(${c.width.toFixed(1)}x${c.height.toFixed(1)}) ` +
        `${c.isUserPositioned ? '[USER_POSITIONED - DO NOT MOVE]' : '[auto]'}`
    )
    .join('\n');

  return [
    {
      role: 'system',
      content: `You are a layout optimization engine for exam cheatsheets.

Given a set of content chunks with their current positions and sizes on pages, optimize the layout to:
1. Minimize wasted white space
2. Group related content (same parent/importance) together
3. Maintain readability with logical flow (top-to-bottom, left-to-right)
4. Ensure no chunks overlap
5. Keep all chunks within page margins

Page configuration:
- Page size: ${pageConfig.width}mm × ${pageConfig.height}mm
- Margins: top=${pageConfig.margins.top}mm, right=${pageConfig.margins.right}mm, bottom=${pageConfig.margins.bottom}mm, left=${pageConfig.margins.left}mm
- Available area: ${pageConfig.width - pageConfig.margins.left - pageConfig.margins.right}mm × ${pageConfig.height - pageConfig.margins.top - pageConfig.margins.bottom}mm
- Total pages: ${pageConfig.pages}
- Font size: ${fontSize}pt

CRITICAL RULES:
- Chunks marked [USER_POSITIONED] must NOT be moved. Keep their exact position.
- All other chunks can be repositioned.
- Chunk sizes (width/height) should remain unchanged.
- All positions must be within page margins.
- No overlapping chunks on the same page.

Output a JSON object:
{
  "optimizedChunks": [
    { "nodeId": "...", "page": 0, "x": 5.0, "y": 5.0 },
    ...
  ]
}

Only include chunks that CHANGED position. Omit unchanged chunks.`,
    },
    {
      role: 'user',
      content: `Current layout (${chunkBBoxes.length} chunks, ${userPositioned.length} user-positioned):

${bboxList}

Optimize the layout of auto-positioned chunks while respecting user-positioned chunks as fixed constraints.`,
    },
  ];
}

/**
 * Pre-process chunks for L6: calculate bounding boxes and classify
 * user-positioned vs auto-positioned chunks.
 */
export function classifyChunks(
  containers: Array<{
    id: string;
    parentNodeId: string;
    title: string;
    page: number;
    chunks: Array<{
      nodeId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      isUserPositioned?: boolean;
    }>;
  }>,
  nodeNames: Record<string, string>,
  nodeImportances: Record<string, string>
): ChunkBBox[] {
  const result: ChunkBBox[] = [];

  for (const container of containers) {
    for (const chunk of container.chunks) {
      result.push({
        nodeId: chunk.nodeId,
        name: nodeNames[chunk.nodeId] || chunk.nodeId,
        importance: nodeImportances[chunk.nodeId] || 'Important',
        page: container.page,
        x: chunk.x,
        y: chunk.y,
        width: chunk.width,
        height: chunk.height,
        isUserPositioned: chunk.isUserPositioned || false,
      });
    }
  }

  return result;
}
