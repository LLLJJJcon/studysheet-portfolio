import { ITreeNode } from '../../models/ContentTree';
import { ContentTree } from '../../models/ContentTree';
import { Chunk } from '../../models/Chunk';
import { ToolCall } from '../LLMProvider';

/**
 * Execute agent tool calls against the database.
 * Returns the tool result as a string to feed back to the LLM.
 */
export async function executeToolCall(
  toolCall: ToolCall,
  courseId: string
): Promise<string> {
  const args = JSON.parse(toolCall.arguments);

  switch (toolCall.name) {
    case 'get_node_content':
      return getNodeContent(courseId, args.nodeId);
    case 'get_subtree':
      return getSubtree(courseId, args.nodeId, args.maxDepth ?? 3);
    case 'search_nodes':
      return searchNodes(courseId, args.query, args.maxResults ?? 10);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolCall.name}` });
  }
}

async function getNodeContent(courseId: string, nodeId: string): Promise<string> {
  const chunk = await Chunk.findOne({ courseId, nodeId });
  const contentTree = await ContentTree.findOne({ courseId });

  if (!contentTree) {
    return JSON.stringify({ error: 'Content tree not found' });
  }

  const node = findNode(contentTree.tree, nodeId);
  if (!node) {
    return JSON.stringify({ error: `Node ${nodeId} not found in tree` });
  }

  return JSON.stringify({
    nodeId: node.nodeId,
    name: node.name,
    importance: node.importance || 'N/A',
    childCount: node.children?.length || 0,
    content: chunk?.content || '(no chunk content)',
    wordCount: chunk?.wordCount || 0,
  });
}

async function getSubtree(
  courseId: string,
  nodeId: string,
  maxDepth: number
): Promise<string> {
  const contentTree = await ContentTree.findOne({ courseId });
  if (!contentTree) {
    return JSON.stringify({ error: 'Content tree not found' });
  }

  let root: ITreeNode | null;
  if (nodeId === 'root') {
    root = contentTree.tree;
  } else {
    root = findNode(contentTree.tree, nodeId);
  }

  if (!root) {
    return JSON.stringify({ error: `Node ${nodeId} not found` });
  }

  const serialized = serializeTree(root, maxDepth);
  return JSON.stringify(serialized);
}

async function searchNodes(
  courseId: string,
  query: string,
  maxResults: number
): Promise<string> {
  const contentTree = await ContentTree.findOne({ courseId });
  if (!contentTree) {
    return JSON.stringify({ error: 'Content tree not found' });
  }

  const lowerQuery = query.toLowerCase();
  const matches: Array<{
    nodeId: string;
    name: string;
    importance: string;
    contentSnippet: string;
  }> = [];

  // Search node names in tree
  const allNodes = flattenTree(contentTree.tree);
  const nameMatches = allNodes.filter((n) =>
    n.name.toLowerCase().includes(lowerQuery)
  );

  // Also search chunk content
  const chunks = await Chunk.find({
    courseId,
    content: { $regex: query, $options: 'i' },
  }).limit(maxResults);

  const chunkNodeIds = new Set(chunks.map((c) => c.nodeId));

  // Merge: name matches first, then content matches
  for (const node of nameMatches) {
    if (matches.length >= maxResults) break;
    const chunk = chunks.find((c) => c.nodeId === node.nodeId);
    matches.push({
      nodeId: node.nodeId,
      name: node.name,
      importance: node.importance || 'N/A',
      contentSnippet: chunk
        ? chunk.content.substring(0, 100) + '...'
        : '(no content)',
    });
  }

  // Add content-only matches
  for (const chunk of chunks) {
    if (matches.length >= maxResults) break;
    if (matches.some((m) => m.nodeId === chunk.nodeId)) continue;
    const node = allNodes.find((n) => n.nodeId === chunk.nodeId);
    matches.push({
      nodeId: chunk.nodeId,
      name: node?.name || chunk.nodeId,
      importance: node?.importance || chunk.importance,
      contentSnippet: chunk.content.substring(0, 100) + '...',
    });
  }

  return JSON.stringify({ results: matches, total: matches.length });
}

// --- Helpers ---

function findNode(node: ITreeNode, nodeId: string): ITreeNode | null {
  if (node.nodeId === nodeId) return node;
  for (const child of node.children || []) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

function serializeTree(
  node: ITreeNode,
  maxDepth: number,
  currentDepth = 0
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    nodeId: node.nodeId,
    name: node.name,
    importance: node.importance || undefined,
  };

  if (maxDepth === -1 || currentDepth < maxDepth) {
    result.children = (node.children || []).map((child) =>
      serializeTree(child, maxDepth, currentDepth + 1)
    );
  } else if (node.children?.length) {
    result.childCount = node.children.length;
  }

  return result;
}

function flattenTree(node: ITreeNode): ITreeNode[] {
  const result: ITreeNode[] = [node];
  for (const child of node.children || []) {
    result.push(...flattenTree(child));
  }
  return result;
}
