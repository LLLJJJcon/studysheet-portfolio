import { ITreeNode } from '../models/ContentTree';

export interface MergeOperation {
  op: 'add_node' | 'add_subtree' | 'merge_chunk' | 'discard';
  new_node_id: string;
  target_parent_id?: string;
  existing_node_id?: string;
  position?: 'before' | 'after';
  ref_sibling_id?: string;
  reason?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  operations: MergeOperation[];
}

function collectNodeIds(node: ITreeNode, ids: Set<string>): void {
  ids.add(node.nodeId);
  for (const child of node.children || []) collectNodeIds(child, ids);
}

function collectLeafIds(node: ITreeNode, ids: Set<string>): void {
  if (!node.children || node.children.length === 0) {
    ids.add(node.nodeId);
  }
  for (const child of node.children || []) collectLeafIds(child, ids);
}

function findNode(node: ITreeNode, nodeId: string): ITreeNode | null {
  if (node.nodeId === nodeId) return node;
  for (const child of node.children || []) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

export function validateMergeOperations(
  raw: unknown,
  existingTree: ITreeNode,
  newTree: ITreeNode
): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Response is not a JSON object'], operations: [] };
  }

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.operations)) {
    return { valid: false, errors: ['Missing "operations" array'], operations: [] };
  }

  const operations = obj.operations as MergeOperation[];

  const existingIds = new Set<string>();
  collectNodeIds(existingTree, existingIds);

  const newIds = new Set<string>();
  collectNodeIds(newTree, newIds);

  const newLeafIds = new Set<string>();
  collectLeafIds(newTree, newLeafIds);

  const seenNewIds = new Set<string>();
  const validOps = ['add_node', 'add_subtree', 'merge_chunk', 'discard'];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const prefix = `Operation ${i}`;

    if (!validOps.includes(op.op)) {
      errors.push(`${prefix}: invalid op "${op.op}"`);
      continue;
    }

    if (!op.new_node_id || !newIds.has(op.new_node_id)) {
      errors.push(`${prefix}: new_node_id "${op.new_node_id}" not found in new tree`);
      continue;
    }

    if (seenNewIds.has(op.new_node_id)) {
      errors.push(`${prefix}: new_node_id "${op.new_node_id}" appears in multiple operations`);
    }
    seenNewIds.add(op.new_node_id);

    if (op.op === 'add_node' || op.op === 'add_subtree') {
      if (!op.target_parent_id || !existingIds.has(op.target_parent_id)) {
        errors.push(`${prefix}: target_parent_id "${op.target_parent_id}" not found in existing tree`);
      }

      if (op.ref_sibling_id && op.target_parent_id) {
        const parent = findNode(existingTree, op.target_parent_id);
        if (parent) {
          const childIds = (parent.children || []).map(c => c.nodeId);
          if (!childIds.includes(op.ref_sibling_id)) {
            errors.push(`${prefix}: ref_sibling_id "${op.ref_sibling_id}" is not a child of target_parent_id "${op.target_parent_id}"`);
          }
        }
      }
    }

    if (op.op === 'merge_chunk') {
      if (!op.existing_node_id || !existingIds.has(op.existing_node_id)) {
        errors.push(`${prefix}: existing_node_id "${op.existing_node_id}" not found in existing tree`);
      }
    }
  }

  const coveredLeafIds = new Set<string>();
  for (const op of operations) {
    if (!op.new_node_id) continue;
    if (op.op === 'add_subtree') {
      const subtreeRoot = findNode(newTree, op.new_node_id);
      if (subtreeRoot) collectLeafIds(subtreeRoot, coveredLeafIds);
    } else {
      if (newLeafIds.has(op.new_node_id)) {
        coveredLeafIds.add(op.new_node_id);
      }
    }
  }

  for (const leafId of newLeafIds) {
    if (!coveredLeafIds.has(leafId)) {
      errors.push(`New leaf node "${leafId}" not covered by any operation`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    operations: errors.length === 0 ? operations : [],
  };
}
