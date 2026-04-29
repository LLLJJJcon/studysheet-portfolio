import { ChatMessage } from '../LLMProvider';
import { ITreeNode } from '../../models/ContentTree';

// Find a tree node by ID using depth-first search
function findNode(node: ITreeNode, id: string): ITreeNode | null {
  if (node.nodeId === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

// Find the path of node names from root to a given nodeId
function findPath(node: ITreeNode, id: string, trail: string[] = []): string[] | null {
  const nextTrail = [...trail, node.name];
  if (node.nodeId === id) return nextTrail;
  for (const child of node.children || []) {
    const p = findPath(child, id, nextTrail);
    if (p) return p;
  }
  return null;
}

// Serialize a tree node to indented text with IDs and importance annotations
function serializeTree(node: ITreeNode, depth = 0): string {
  const indent = '  '.repeat(depth);
  let line = `${indent}- ${node.name} (id: ${node.nodeId})`;
  if (node.importance) line += ` [${node.importance}]`;
  line += '\n';
  for (const child of node.children || []) {
    line += serializeTree(child, depth + 1);
  }
  return line;
}

/**
 * Targeted repair prompt: the previous diff pass returned an answer that
 * parsed cleanly but missed some leaves. Rather than redo the whole diff,
 * feed back the exact missing leaves (with their path in the new tree) and
 * ask the model to produce operations ONLY for those leaves.
 */
// Build a targeted repair prompt for covering leaves missed by the initial merge diff
export function buildMergeTreeDiffRepairPrompt(
  courseName: string,
  existingTree: ITreeNode,
  newTree: ITreeNode,
  missingLeafIds: string[],
): ChatMessage[] {
  const existingSerialized = serializeTree(existingTree);

  const missingDescriptions = missingLeafIds
    .map((id) => {
      const node = findNode(newTree, id);
      const path = findPath(newTree, id) || [id];
      const imp = node?.importance ? ` [${node.importance}]` : '';
      return `- id: ${id} | path: ${path.join(' > ')}${imp}`;
    })
    .join('\n');

  return [
    {
      role: 'system',
      content: `You are an expert exam preparation assistant for the course "${courseName}".

A previous merge-diff pass produced operations for most leaves in a new content tree, but it MISSED some leaves. Your job now is to produce operations for ONLY those missing leaves.

Output JSON shape:
{"operations": [ ... ]}

Allowed ops (same semantics as before):
1. add_node — leaf is new, no overlap.
   {"op":"add_node","new_node_id":"<missing id>","target_parent_id":"<id in existing tree>","position":"after","ref_sibling_id":"<optional>"}
2. merge_chunk — leaf overlaps an existing leaf; new content supplements it.
   {"op":"merge_chunk","new_node_id":"<missing id>","existing_node_id":"<id in existing tree>","reason":"..."}
3. discard — leaf is pure duplicate of existing content.
   {"op":"discard","new_node_id":"<missing id>","reason":"..."}

Rules:
- You MUST output exactly one operation for EVERY id in the "Missing leaves" list below. Do not skip any.
- Only use new_node_ids from the missing-leaves list.
- target_parent_id / existing_node_id MUST come from the existing tree below.
- Output ONLY valid JSON. No markdown, no code blocks, no explanations.`,
    },
    {
      role: 'user',
      content: `Existing tree (valid target_parent_id / existing_node_id values come from here):
${existingSerialized}
Missing leaves you MUST cover (one operation each):
${missingDescriptions}`,
    },
  ];
}
