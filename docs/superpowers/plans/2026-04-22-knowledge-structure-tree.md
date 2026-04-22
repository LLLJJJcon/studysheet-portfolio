# Knowledge-Structure Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove filename-based second-level nodes from the content tree, organize by knowledge structure, and track source files at the chunk level via `sourceFiles`.

**Architecture:** Modify the L1 prompt to produce knowledge-structured trees with `sourceFile` on leaf nodes. Add a `stripFileNameNodes` post-processing guard. Update L2 source-content resolution to use leaf-level `sourceFile` values. Populate `chunk.sourceFiles` in initial generation. Apply same changes to incremental merge.

**Tech Stack:** TypeScript, Node.js, Express, Mongoose

**Spec:** `docs/superpowers/specs/2026-04-22-knowledge-structure-tree-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/src/llm/prompts/L1_treeGeneration.ts` | Modify | Change prompt to output knowledge-structure tree with `sourceFile` on leaves |
| `server/src/services/generationOrchestrator.ts` | Modify | Add `stripFileNameNodes` + `collectSourceFiles` helpers; update L2 source resolution, chunk saving, enriched containers, fallback tree |
| `server/src/services/incrementalMergeService.ts` | Modify | Import and apply `stripFileNameNodes`; update L2 source resolution and tempChunk sourceFile |

---

### Task 1: Update L1 Prompt

**Files:**
- Modify: `server/src/llm/prompts/L1_treeGeneration.ts`

- [ ] **Step 1: Replace the L1 prompt content**

Replace the entire `buildL1Prompt` function body in `server/src/llm/prompts/L1_treeGeneration.ts` with:

```typescript
import { ChatMessage } from '../LLMProvider';

export function buildL1Prompt(
  courseName: string,
  files: { filename: string; content: string }[]
): ChatMessage[] {
  const fileContents = files
    .map((f, i) => `--- File ${i + 1}: ${f.filename} ---\n${f.content}`)
    .join('\n\n');

  const filenameList = files.map((f) => f.filename).join(', ');

  return [
    {
      role: 'system',
      content: `You are an expert exam preparation assistant. Your task is to analyze course materials and build a structured exam-point content tree.

The tree structure rules:
- Root node: the course name "${courseName}"
- Organize by knowledge structure: group by topics, chapters, or concept areas — NOT by source file
- Do NOT create file-level grouping nodes. Merge related content from different files under the same topic
- Leaf nodes must have an "importance" field: "High-Frequency", "Important", or "Awareness"
- Leaf nodes must have a "sourceFile" field: the filename of the primary source file for that exam point. Must be one of: ${filenameList}
- Non-leaf nodes should NOT have importance or sourceFile
- Importance should be assigned from a GLOBAL perspective across all files to ensure cross-file consistency

Importance criteria:
- "High-Frequency": Highly likely to appear in exam questions
- "Important": Core concepts that need to be mastered
- "Awareness": Background knowledge or low-frequency exam points

Output format: valid JSON with this structure:
{
  "tree": {
    "name": "${courseName}",
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

IMPORTANT: Output ONLY valid JSON. No markdown, no code blocks, no explanations.`,
    },
    {
      role: 'user',
      content: `Course: ${courseName}\n\nAnalyze the following course materials and generate the exam-point content tree:\n\n${fileContents}`,
    },
  ];
}
```

Key changes from the original:
- Removed: `"Second-level nodes: one per source file (use the filename as the node name)"`
- Added: `"Organize by knowledge structure"` and `"Do NOT create file-level grouping nodes"`
- Added: `"Leaf nodes must have a sourceFile field"` with the allowed filename list
- Added: `"Non-leaf nodes should NOT have ... sourceFile"`
- Updated example JSON to show `sourceFile` on leaf nodes

- [ ] **Step 2: Verify the file compiles**

Run: `cd server && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `L1_treeGeneration.ts`

- [ ] **Step 3: Commit**

```bash
git add server/src/llm/prompts/L1_treeGeneration.ts
git commit -m "feat(L1): prompt now produces knowledge-structure tree with sourceFile on leaves"
```

---

### Task 2: Add `stripFileNameNodes` and `collectSourceFiles` Helpers

**Files:**
- Modify: `server/src/services/generationOrchestrator.ts`

- [ ] **Step 1: Add `collectSourceFiles` helper**

Insert after the `findNodeById` function (after line 215) in `generationOrchestrator.ts`:

```typescript
export function collectSourceFiles(node: ITreeNode): Set<string> {
  const sources = new Set<string>();
  if (node.sourceFile) sources.add(node.sourceFile);
  for (const child of node.children || []) {
    for (const s of collectSourceFiles(child)) sources.add(s);
  }
  return sources;
}
```

- [ ] **Step 2: Add `stripFileNameNodes` function**

Insert immediately after `collectSourceFiles`:

```typescript
function propagateSourceFile(node: ITreeNode, sourceFile: string): void {
  if (!node.children || node.children.length === 0) {
    if (!node.sourceFile) node.sourceFile = sourceFile;
    return;
  }
  for (const child of node.children) propagateSourceFile(child, sourceFile);
}

export function stripFileNameNodes(tree: ITreeNode, filenames: string[]): ITreeNode {
  const nameSet = new Set(filenames.map(f => f.toLowerCase().trim()));
  const noExtSet = new Set(filenames.map(f => {
    const dot = f.lastIndexOf('.');
    return (dot > 0 ? f.substring(0, dot) : f).toLowerCase().trim();
  }));

  const newChildren: ITreeNode[] = [];

  for (const child of tree.children || []) {
    const lower = child.name.toLowerCase().trim();
    const isFileNode =
      (nameSet.has(lower) || noExtSet.has(lower)) &&
      child.children &&
      child.children.length > 0;

    if (isFileNode) {
      const sourceFile = child.sourceFile || child.name;
      propagateSourceFile(child, sourceFile);
      for (const grandchild of child.children) {
        newChildren.push(grandchild);
      }
    } else {
      newChildren.push(child);
    }
  }

  return { ...tree, children: newChildren };
}
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd server && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/src/services/generationOrchestrator.ts
git commit -m "feat: add stripFileNameNodes and collectSourceFiles helpers"
```

---

### Task 3: Update Initial Generation Pipeline

**Files:**
- Modify: `server/src/services/generationOrchestrator.ts`

This task makes 5 changes in the `startGeneration` method:

- [ ] **Step 1: Update `buildFallbackTree`**

Replace the `buildFallbackTree` function (lines 175–184) with:

```typescript
function buildFallbackTree(courseName: string, files: Array<{ filename: string }>): Record<string, unknown> {
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

Change: added `importance: 'Important'` so fallback leaves are valid leaf nodes for L2.

- [ ] **Step 2: Apply `stripFileNameNodes` after `assignNodeIds`**

Replace line 371:
```typescript
      const treeWithIds = assignNodeIds(parsedTree);
```

With:
```typescript
      const treeWithIds = stripFileNameNodes(
        assignNodeIds(parsedTree),
        filesForL1.map(f => f.filename)
      );
```

- [ ] **Step 3: Update L2 source content resolution**

Replace lines 410–413 (the source content resolution block inside the L2 `batch.map` callback):
```typescript
            // Determine source content for this subtree
            const sourceContentRaw = subtree.sourceFile
              ? fileContentMap.get(subtree.sourceFile) || allContent
              : allContent;
```

With:
```typescript
            // Determine source content for this subtree from leaf sourceFile values
            const subtreeSources = collectSourceFiles(subtree);
            let sourceContentRaw = '';
            if (subtreeSources.size > 0) {
              const parts: string[] = [];
              for (const sf of subtreeSources) {
                const fc = fileContentMap.get(sf);
                if (fc) parts.push(fc);
              }
              sourceContentRaw = parts.length > 0 ? parts.join('\n\n') : allContent;
            } else {
              sourceContentRaw = allContent;
            }
```

- [ ] **Step 4: Update L2 chunk saving to include `sourceFiles`**

Replace lines 440–448 (the `upsertChunk` call inside the L2 main loop):
```typescript
              await chunkService.upsertChunk(
                courseId,
                c.node_id,
                typeof c.content === 'string' ? c.content : '',
                c.word_count || 0,
                importance,
                c.source_start || '',
                c.source_end || ''
              );
```

With:
```typescript
              const leafSourceFile = leafNode?.sourceFile;
              await chunkService.upsertChunk(
                courseId,
                c.node_id,
                typeof c.content === 'string' ? c.content : '',
                c.word_count || 0,
                importance,
                c.source_start || '',
                c.source_end || '',
                leafSourceFile ? [leafSourceFile] : undefined
              );
```

- [ ] **Step 5: Update L2 reconciliation source content resolution**

Replace lines 496–500 (source resolution in the reconciliation retry loop):
```typescript
            const sourceContentRaw = subtree.sourceFile
              ? fileContentMap.get(subtree.sourceFile) || allContent
              : allContent;
            const sourceContent = truncateForLLM(sourceContentRaw, MAX_L2_SOURCE_CHARS);
```

With:
```typescript
            const retrySources = collectSourceFiles(subtree);
            let retrySourceRaw = '';
            if (retrySources.size > 0) {
              const parts: string[] = [];
              for (const sf of retrySources) {
                const fc = fileContentMap.get(sf);
                if (fc) parts.push(fc);
              }
              retrySourceRaw = parts.length > 0 ? parts.join('\n\n') : allContent;
            } else {
              retrySourceRaw = allContent;
            }
            const sourceContent = truncateForLLM(retrySourceRaw, MAX_L2_SOURCE_CHARS);
```

- [ ] **Step 6: Update L2 reconciliation chunk saving to include `sourceFiles`**

Replace lines 515–522 (the `upsertChunk` call in reconciliation):
```typescript
                await chunkService.upsertChunk(
                  courseId,
                  c.node_id,
                  typeof c.content === 'string' ? c.content : '',
                  c.word_count || 0,
                  importance,
                  c.source_start || '',
                  c.source_end || ''
                );
```

With:
```typescript
                const leafSourceFile = leafNode?.sourceFile;
                await chunkService.upsertChunk(
                  courseId,
                  c.node_id,
                  typeof c.content === 'string' ? c.content : '',
                  c.word_count || 0,
                  importance,
                  c.source_start || '',
                  c.source_end || '',
                  leafSourceFile ? [leafSourceFile] : undefined
                );
```

- [ ] **Step 7: Add `sourceFiles` to enriched containers**

Replace line 636 (inside the enriched container chunk map, after the `name` field):
```typescript
            name: nodeNames.get(chunk.nodeId) || '',
```

With:
```typescript
            name: nodeNames.get(chunk.nodeId) || '',
            sourceFiles: (chunkData as any)?.sourceFiles || [],
```

- [ ] **Step 8: Verify the file compiles**

Run: `cd server && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add server/src/services/generationOrchestrator.ts
git commit -m "feat: update initial generation to use knowledge-structure tree and populate sourceFiles"
```

---

### Task 4: Update Incremental Merge Service

**Files:**
- Modify: `server/src/services/incrementalMergeService.ts`

- [ ] **Step 1: Add import for `stripFileNameNodes` and `collectSourceFiles`**

Replace line 21 of `incrementalMergeService.ts`:
```typescript
import {
  streamCollect,
  extractJSON,
  toSafeNode,
  assignNodeIds,
  truncateForLLM,
  mapLLMErrorToUserMessage,
} from './generationOrchestrator';
```

With:
```typescript
import {
  streamCollect,
  extractJSON,
  toSafeNode,
  assignNodeIds,
  truncateForLLM,
  mapLLMErrorToUserMessage,
  stripFileNameNodes,
  collectSourceFiles,
} from './generationOrchestrator';
```

- [ ] **Step 2: Apply `stripFileNameNodes` after new-file L1**

Replace line 264:
```typescript
      const tempTree = assignNodeIds(tempTreeRaw);
```

With:
```typescript
      const tempTree = stripFileNameNodes(
        assignNodeIds(tempTreeRaw),
        filesWithContent.map(f => f.originalName)
      );
```

- [ ] **Step 3: Update L2 source content resolution in incremental merge**

Replace lines 280–286 (source resolution inside the L2 batch loop):
```typescript
          try {
            const sourceRaw = subtree.sourceFile
              ? fileContentMap.get(subtree.sourceFile) || allNewContent
              : allNewContent;
            const sourceContent = truncateForLLM(sourceRaw, MAX_L2_SOURCE_CHARS);
            if (!sourceContent.trim()) return;
```

With:
```typescript
          try {
            const subtreeSources = collectSourceFiles(subtree);
            let sourceRaw = '';
            if (subtreeSources.size > 0) {
              const parts: string[] = [];
              for (const sf of subtreeSources) {
                const fc = fileContentMap.get(sf);
                if (fc) parts.push(fc);
              }
              sourceRaw = parts.length > 0 ? parts.join('\n\n') : allNewContent;
            } else {
              sourceRaw = allNewContent;
            }
            const sourceContent = truncateForLLM(sourceRaw, MAX_L2_SOURCE_CHARS);
            if (!sourceContent.trim()) return;
```

- [ ] **Step 4: Update tempChunk sourceFile to use leaf node**

Replace lines 301–309 (inside the chunk processing loop, where `tempChunks.set` is called):
```typescript
            for (const c of chunks) {
              const leafNode = findNodeById(subtree, c.node_id);
              const importance = leafNode?.importance || 'Important';
              const sourceFile = subtree.sourceFile || filesWithContent[0]?.originalName || '';
              tempChunks.set(c.node_id, {
                nodeId: c.node_id,
                content: typeof c.content === 'string' ? c.content : '',
                wordCount: typeof c.content === 'string' ? c.content.length : 0,
                importance,
                sourceFile,
              });
            }
```

With:
```typescript
            for (const c of chunks) {
              const leafNode = findNodeById(subtree, c.node_id);
              const importance = leafNode?.importance || 'Important';
              const sourceFile = leafNode?.sourceFile || filesWithContent[0]?.originalName || '';
              tempChunks.set(c.node_id, {
                nodeId: c.node_id,
                content: typeof c.content === 'string' ? c.content : '',
                wordCount: typeof c.content === 'string' ? c.content.length : 0,
                importance,
                sourceFile,
              });
            }
```

Change: `subtree.sourceFile` → `leafNode?.sourceFile`

- [ ] **Step 5: Verify the file compiles**

Run: `cd server && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add server/src/services/incrementalMergeService.ts
git commit -m "feat: update incremental merge to use knowledge-structure tree"
```

---

### Task 5: Full Compilation and Smoke Test

**Files:**
- All modified files

- [ ] **Step 1: Full TypeScript compilation check**

Run: `cd server && npx tsc --noEmit --pretty`
Expected: Zero errors

- [ ] **Step 2: Verify no circular imports or missing exports**

Run: `cd server && node -e "require('./dist/services/generationOrchestrator')" 2>&1 || echo "Need to build first"`
Run: `cd server && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Quick grep to verify no remaining references to old pattern**

Run these to confirm all old `subtree.sourceFile` references in L2 source resolution are gone:

```bash
grep -n "subtree\.sourceFile" server/src/services/generationOrchestrator.ts
grep -n "subtree\.sourceFile" server/src/services/incrementalMergeService.ts
```

Expected for `generationOrchestrator.ts`: No matches
Expected for `incrementalMergeService.ts`: No matches (the `subtree.sourceFile` in Stage 6 execute merge at line 303 was already changed in Task 4 Step 4)

- [ ] **Step 4: Verify exports are accessible**

```bash
cd server && node -e "
const m = require('./dist/services/generationOrchestrator');
console.log('stripFileNameNodes:', typeof m.stripFileNameNodes);
console.log('collectSourceFiles:', typeof m.collectSourceFiles);
"
```

Expected:
```
stripFileNameNodes: function
collectSourceFiles: function
```

- [ ] **Step 5: Final commit if any fixes were needed**

Only if previous steps required fixes:
```bash
git add -A
git commit -m "fix: resolve compilation issues from knowledge-structure tree changes"
```
