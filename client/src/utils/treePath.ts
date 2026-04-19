import { TreeNode } from '../types/tree';

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
