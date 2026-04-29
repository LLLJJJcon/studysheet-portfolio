import { ChatMessage } from '../LLMProvider';
import { ITreeNode } from '../../models/ContentTree';

// Serialize a tree to indented text with node IDs and importance labels
function serializeTreeStructure(node: ITreeNode, depth = 0): string {
  const indent = '  '.repeat(depth);
  let line = `${indent}- ${node.name} (id: ${node.nodeId})`;
  if (node.importance) line += ` [${node.importance}]`;
  line += '\n';
  for (const child of node.children || []) {
    line += serializeTreeStructure(child, depth + 1);
  }
  return line;
}

// Build a prompt for generating a merge plan between existing and new content trees
export function buildMergeTreeDiffPrompt(
  courseName: string,
  existingTree: ITreeNode,
  newTree: ITreeNode
): ChatMessage[] {
  const existingSerialized = serializeTreeStructure(existingTree);
  const newSerialized = serializeTreeStructure(newTree);

  return [
    {
      role: 'system',
      content: `You are an expert exam preparation assistant for the course "${courseName}".

Your task: Compare an EXISTING content tree with a NEW content tree (generated from newly uploaded files) and produce a merge plan.

You must output a JSON object with an "operations" array. Each operation is one of:

1. **add_node** — A new LEAF node with no overlap in the existing tree. Add it under an existing parent.
   {"op": "add_node", "new_node_id": "<id from new tree>", "target_parent_id": "<id from existing tree>", "position": "after", "ref_sibling_id": "<id of sibling in existing tree, or omit to append>"}

2. **add_subtree** — A new NON-LEAF subtree where ALL descendants are new (no overlap). Graft entire subtree under an existing parent.
   {"op": "add_subtree", "new_node_id": "<id from new tree>", "target_parent_id": "<id from existing tree>", "position": "after", "ref_sibling_id": "<optional>"}

3. **merge_chunk** — A new leaf node overlaps with an existing leaf node, but the new content adds supplementary value. Will trigger content merging.
   {"op": "merge_chunk", "new_node_id": "<id from new tree>", "existing_node_id": "<id from existing tree>", "reason": "<brief reason>"}

4. **discard** — A new leaf node is purely redundant (duplicate of existing content). Drop it.
   {"op": "discard", "new_node_id": "<id from new tree>", "reason": "<brief reason>"}

Rules:
- Every LEAF node in the new tree MUST appear in exactly ONE operation
- Every new_node_id MUST come from the new tree
- Every target_parent_id and existing_node_id MUST come from the existing tree
- Use add_subtree ONLY if ALL descendants of that subtree are new (no partial overlap)
- If ref_sibling_id is provided, it must be a direct child of target_parent_id
- Prefer discard for truly redundant content; use merge_chunk only when new content adds genuine supplementary value
- position is "after" (default) or "before" relative to ref_sibling_id; omit ref_sibling_id to append at end
- You do NOT need to create a file-level node for the new file — merge content wherever it fits best semantically
- Output ONLY valid JSON. No markdown, no code blocks, no explanations.`,
    },
    {
      role: 'user',
      content: `Existing tree:\n${existingSerialized}\nNew tree (from newly uploaded files):\n${newSerialized}`,
    },
  ];
}
