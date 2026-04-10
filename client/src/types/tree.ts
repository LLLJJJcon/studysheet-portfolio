export type Importance = 'High-Frequency' | 'Important' | 'Awareness';

export interface TreeNode {
  nodeId: string;
  name: string;
  sourceFile?: string;
  importance?: Importance;
  children: TreeNode[];
}
