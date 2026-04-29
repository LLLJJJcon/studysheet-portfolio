import { TreeNode } from '../types/tree';

// Build a breadcrumb path string from the tree root to the target node
export function getTreePath(tree: TreeNode, targetNodeId: string): string {
  const path: string[] = [];

  function dfs(node: TreeNode): boolean {
    path.push(node.name);
    if (node.nodeId === targetNodeId) return true;
    for (const child of node.children) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  }

  if (dfs(tree)) return path.join(' > ');
  return '';
}
