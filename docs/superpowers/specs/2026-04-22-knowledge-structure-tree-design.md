# Knowledge-Structure Tree Redesign

## Problem

The L1 tree generation prompt forces second-level nodes to be filenames. When files are appended via incremental merge, the new tree also has filename nodes. Despite the Diff prompt instructing the LLM to "merge content wherever it fits best semantically," the `add_subtree` operation grafts entire subtrees (including filename nodes) into the existing tree. This produces a merged tree with mixed filename and knowledge-structure nodes at the same hierarchy level.

## Goal

Reorganize the content tree to be purely knowledge-structure based. Source file tracking moves entirely to the chunk level via the existing `sourceFiles` field on the Chunk model.

## Design Decisions (confirmed with user)

1. Both initial generation and incremental merge produce knowledge-structure trees (no filename second-level nodes)
2. L1 prompt annotates leaf nodes with `sourceFile` to track provenance
3. A post-processing `stripFileNameNodes` function provides a safety net in case the LLM still outputs filename nodes
4. Client-side code requires no changes

## Changes

### 1. L1 Prompt (`server/src/llm/prompts/L1_treeGeneration.ts`)

**Current behavior:** Forces `"Second-level nodes: one per source file (use the filename as the node name)"`.

**New behavior:**
- Remove the file-per-second-level-node rule
- Instruct the LLM to organize the tree by knowledge structure (topics, chapters, concepts)
- Require leaf nodes to include a `sourceFile` field indicating which uploaded file the content originates from
- Update the example JSON output to show `sourceFile` on leaf nodes instead of on second-level file-group nodes

New prompt excerpt (key rules section):
```
The tree structure rules:
- Root node: the course name "{courseName}"
- Organize by knowledge structure: group by topics, chapters, or concept areas — NOT by source file
- Do NOT create file-level grouping nodes. Merge related content from different files under the same topic
- Leaf nodes must have an "importance" field: "High-Frequency", "Important", or "Awareness"
- Leaf nodes must have a "sourceFile" field: the filename of the primary source file for that exam point
- Non-leaf nodes should NOT have importance or sourceFile
```

New example JSON output:
```json
{
  "tree": {
    "name": "courseName",
    "children": [
      {
        "name": "Topic Area",
        "children": [
          {
            "name": "Subtopic",
            "children": [
              {
                "name": "Exam Point",
                "importance": "High-Frequency",
                "sourceFile": "lecture1.pdf"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### 2. Post-processing: `stripFileNameNodes` (`server/src/services/generationOrchestrator.ts`)

New exported function to guard against LLM non-compliance. Called after `assignNodeIds` in both initial generation and incremental merge.

**Signature:**
```typescript
export function stripFileNameNodes(tree: ITreeNode, filenames: string[]): ITreeNode
```

**Logic:**
1. Build a Set of normalized filenames (case-insensitive, trimmed) from the uploaded files
2. Walk the tree's second-level children (direct children of root)
3. For each second-level node, check if its `name` matches a filename in the set (exact or after stripping extension) AND it has children (is not a leaf node)
4. If it matches and has children:
   - Propagate the node's `sourceFile` (or its `name` as filename) down to any descendant leaf nodes that lack a `sourceFile`
   - Hoist its children up to the root level (replace the filename node with its children)
5. Return the modified tree

**Edge cases:**
- A filename node with zero children: remove it entirely (no content)
- A filename node whose children are all leaves: hoist them directly under root
- Nested filename nodes (shouldn't happen, but handle recursively)

### 3. Initial Generation L2 Changes (`server/src/services/generationOrchestrator.ts`)

#### 3a. Source content resolution for L2

**Current:** L2 iterates `secondLevelNodes` (file nodes), uses `subtree.sourceFile` to look up the file content.

**New:** L2 still iterates second-level nodes (now knowledge-topic nodes). For each subtree:
1. Collect all unique `sourceFile` values from its leaf nodes
2. For each sourceFile, look up the file content from `fileContentMap`
3. Concatenate all relevant file contents as the source input, truncated to `MAX_L2_SOURCE_CHARS`
4. If no leaf has `sourceFile`, fall back to `allContent` (all files concatenated)

Implementation helper:
```typescript
function collectSourceFiles(node: ITreeNode): Set<string> {
  const sources = new Set<string>();
  if (node.sourceFile) sources.add(node.sourceFile);
  for (const child of node.children || []) {
    for (const s of collectSourceFiles(child)) sources.add(s);
  }
  return sources;
}
```

#### 3b. Chunk `sourceFiles` population

**Current:** `upsertChunk` is called without `sourceFiles` parameter (6 args).

**New:** After finding the leaf node for each chunk, read `leafNode.sourceFile` and pass `[leafNode.sourceFile]` as the 8th argument to `upsertChunk`. If `leafNode.sourceFile` is falsy, pass `undefined` (keep current behavior).

```typescript
const leafSourceFile = leafNode?.sourceFile;
await chunkService.upsertChunk(
  courseId, c.node_id, content, wordCount, importance,
  c.source_start || '', c.source_end || '',
  leafSourceFile ? [leafSourceFile] : undefined
);
```

This applies to both the main L2 loop and the L2 reconciliation retry loop.

#### 3c. Enriched containers `sourceFiles`

**Current:** Initial generation's enriched containers do not include `sourceFiles` (only incremental merge does).

**New:** Add `sourceFiles` to the enriched container chunk output:
```typescript
sourceFiles: (chunkData as any)?.sourceFiles || [],
```

This makes the initial generation output consistent with the incremental merge output.

### 4. Fallback Tree (`server/src/services/generationOrchestrator.ts`)

**Current `buildFallbackTree`:** Creates filename nodes as second-level children with no content.

**New:** Since the fallback tree is used when L1 completely fails, keep it simple — create one leaf node per file with `sourceFile` set:
```typescript
function buildFallbackTree(
  courseName: string,
  files: Array<{ filename: string }>
): Record<string, unknown> {
  return {
    name: courseName,
    children: files.map((f) => ({
      name: f.filename,
      importance: 'Important',
      sourceFile: f.filename,
      children: [],
    })),
  };
}
```

This produces leaf nodes (with importance) so L2 can generate chunks for them. Each leaf is named after the file and carries `sourceFile` for tracing.

### 5. Incremental Merge (`server/src/services/incrementalMergeService.ts`)

#### 5a. Apply `stripFileNameNodes` after new-file L1

After `assignNodeIds(tempTreeRaw)` (line 264), call:
```typescript
const tempTree = stripFileNameNodes(
  assignNodeIds(tempTreeRaw),
  filesWithContent.map(f => f.originalName)
);
```

#### 5b. L2 source content resolution

**Current (line 280-286):** Uses `subtree.sourceFile` to find file content.

**New:** Same pattern as section 3a — collect `sourceFile` values from leaf nodes in the subtree, concatenate corresponding file contents.

#### 5c. TempChunk sourceFile

**Current (line 303):** `sourceFile` comes from `subtree.sourceFile` (the file-level node).

**New:** `sourceFile` comes from `leafNode.sourceFile`:
```typescript
const sourceFile = leafNode?.sourceFile || filesWithContent[0]?.originalName || '';
```

## Data Flow Summary

```
Upload files
    ↓
L1: LLM generates knowledge-structure tree
    - Leaf nodes carry sourceFile
    ↓
stripFileNameNodes (safety net)
    - Removes any accidental filename nodes
    - Propagates sourceFile to orphaned leaves
    ↓
L2: Generate chunks per knowledge subtree
    - Source content resolved via leaf sourceFile values
    - Chunk.sourceFiles populated from leaf.sourceFile
    ↓
Layout + Enrichment
    - enriched containers carry sourceFiles
    ↓
Client renders
    - SourceViewer uses chunk.sourceFiles[0] (priority)
    - Falls back to tree node.sourceFile inheritance
```

## What Does NOT Change

- **Chunk model** — `sourceFiles: string[]` field already exists
- **ContentTree model** — `ITreeNode.sourceFile` field already exists
- **L2 prompt** — accepts any subtree structure, leaf-only generation, no change needed
- **L3 compression** — operates on chunks by importance, tree-structure-agnostic
- **L4 layout** — does not use `sourceFile` at all
- **MergeTreeDiff prompt** — already says "do NOT create file-level nodes," no change needed
- **MergeChunkContent prompt** — works on chunk content pairs, tree-agnostic
- **mergeValidator** — validates node IDs and operations, tree-structure-agnostic
- **Client-side code** — `sourceFiles[0]` path already preferred; tree `sourceFile` inheritance still works as fallback
- **SourceViewer** — receives `sourceFile` string, renders file content, no structural dependency

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| LLM ignores new prompt and still groups by filename | `stripFileNameNodes` automatically fixes this |
| LLM assigns wrong `sourceFile` to a leaf | Acceptable — same risk as current L2 source_start/source_end accuracy. User can verify via SourceViewer |
| Multi-file topics split across subtrees | LLM is instructed to merge related content; if it doesn't, each leaf still has correct `sourceFile` |
| Existing courses with filename-tree structure | Not affected — this change only applies to new generations. Existing trees continue to work because client path-2 fallback still traverses `sourceFile` inheritance |
