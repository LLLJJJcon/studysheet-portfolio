import { Container } from '../stores/canvasStore';
import { TreeNode } from '../types/tree';
import { getTreePath } from './treePath';

// Build a labeled index of all chunks for the chat context, excluding the target chunk
export function buildChunkIndex(
  containers: Container[],
  tree: TreeNode,
  excludeNodeId: string
): Array<{ nodeId: string; label: string }> {
  const index: Array<{ nodeId: string; label: string }> = [];

  for (const container of containers) {
    if (!container.chunks) continue;
    for (const chunk of container.chunks) {
      if (chunk.nodeId === excludeNodeId) continue;
      const path = getTreePath(tree, chunk.nodeId);
      const importance = chunk.importance || 'Unknown';
      index.push({
        nodeId: chunk.nodeId,
        label: `[${importance}] ${path || chunk.name || chunk.nodeId}`,
      });
    }
  }

  return index;
}
