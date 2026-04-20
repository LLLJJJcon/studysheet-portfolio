import { IContainer, IChunkPosition } from '../models/Layout';
import { ITreeNode } from '../models/ContentTree';
import { IChunk } from '../models/Chunk';
import { estimateChunkSize } from './chunkSizeEstimator';

/**
 * Pure-algorithm layout engine (no LLM).
 *
 * Strategy:
 *  1. Group chunks by parent node → sized containers
 *  2. Determine column count from page width & font size
 *  3. Find optimal contiguous partition of containers across columns
 *     (minimises max column height while preserving tree order)
 *  4. Place containers within their assigned columns, handling page overflow
 */

const CONTAINER_GAP = 0.5;     // mm between containers
const CHUNK_GAP = 0;           // mm between chunks (tightly packed)
const CONTAINER_TITLE_H = 2;   // mm for section title label
const CONTAINER_PAD_X = 0;     // no horizontal padding
const CONTAINER_PAD_Y = 0;     // no vertical padding
const COL_GAP = 2;             // mm between columns

// ── helpers ──

function buildTreeOrder(node: ITreeNode, map: Map<string, number>, ctr: { i: number }) {
  map.set(node.nodeId, ctr.i++);
  for (const ch of node.children || []) buildTreeOrder(ch, map, ctr);
}

function findNode(tree: ITreeNode, id: string): ITreeNode | null {
  if (tree.nodeId === id) return tree;
  for (const ch of tree.children || []) {
    const f = findNode(ch, id);
    if (f) return f;
  }
  return null;
}

function findParent(tree: ITreeNode, targetId: string): ITreeNode | null {
  for (const ch of tree.children || []) {
    if (ch.nodeId === targetId) return tree;
    const f = findParent(ch, targetId);
    if (f) return f;
  }
  return null;
}

function determineColumnCount(usableWidth: number, fontSize: number): number {
  const charW = 0.35 * fontSize;
  const minCol = charW * 30; // ≥ 30 chars per line for readability
  if (usableWidth < minCol * 1.8) return 1;
  if (usableWidth < minCol * 2.8) return 2;
  return 3;
}

// ── sizing types ──

interface SizedChunk { nodeId: string; estH: number }
interface SizedGroup {
  parentNodeId: string;
  title: string;
  chunks: SizedChunk[];
  totalH: number;
}

// ── main ──

export function computeAlgorithmicLayout(
  chunks: IChunk[],
  tree: ITreeNode,
  pageConfig: { width: number; height: number; pages: number; columns?: number },
  fontSize: number,
  lineHeight: number,
): { containers: IContainer[] } {
  const margin = 5;
  const usableW = pageConfig.width - 2 * margin;
  const usableH = pageConfig.height - 2 * margin;

  // tree order map
  const orderMap = new Map<string, number>();
  buildTreeOrder(tree, orderMap, { i: 0 });

  // filter orphan chunks
  const valid = chunks.filter(c => findNode(tree, c.nodeId));
  if (valid.length !== chunks.length) {
    console.warn(`[algorithmicLayout] ${chunks.length - valid.length}/${chunks.length} chunks filtered out (nodeId not found in tree)`);
  }

  // group by parent node
  const gMap = new Map<string, {
    pid: string; pname: string;
    items: Array<{ nodeId: string; content: string; importance: string; order: number }>;
  }>();
  const gKeys: string[] = [];

  for (const ch of valid) {
    const par = findParent(tree, ch.nodeId);
    const pid = par?.nodeId ?? tree.nodeId;
    const pname = par?.name ?? tree.name;
    if (!gMap.has(pid)) { gMap.set(pid, { pid, pname, items: [] }); gKeys.push(pid); }
    gMap.get(pid)!.items.push({
      nodeId: ch.nodeId, content: ch.content,
      importance: ch.importance, order: orderMap.get(ch.nodeId) ?? 999,
    });
  }
  for (const g of gMap.values()) g.items.sort((a, b) => a.order - b.order);

  // sort groups by tree order of first chunk
  const groups = gKeys
    .map(k => gMap.get(k)!)
    .sort((a, b) => (a.items[0]?.order ?? 999) - (b.items[0]?.order ?? 999));

  // columns
  const colCount = pageConfig.columns && pageConfig.columns >= 1
    ? pageConfig.columns
    : determineColumnCount(usableW, fontSize);
  const colW = (usableW - (colCount - 1) * COL_GAP) / colCount;
  const chunkW = colW - 2 * CONTAINER_PAD_X;
  const minChunkH = fontSize * lineHeight * 0.3528; // 1-line minimum

  // size groups
  const sized: SizedGroup[] = groups.map(g => {
    const sc = g.items.map(c => {
      const s = estimateChunkSize(c.content, fontSize, chunkW, lineHeight);
      return { nodeId: c.nodeId, estH: Math.max(s.height, minChunkH) };
    });
    const bodyH = sc.reduce((sum, c) => sum + c.estH, 0)
      + Math.max(0, sc.length - 1) * CHUNK_GAP;
    const totalH = CONTAINER_TITLE_H + CONTAINER_PAD_Y + bodyH + CONTAINER_PAD_Y;
    return { parentNodeId: g.pid, title: g.pname, chunks: sc, totalH };
  });

  // ── chunk-level flow engine ──
  // Flows chunks into column-slots, splitting containers at chunk boundaries
  // when they exceed the target height.  Each slot = one column on one page.
  // Reading order: (p0,c0), (p0,c1), (p1,c0), (p1,c1), …

  const n = sized.length;
  if (n === 0) return { containers: [] };

  const headerH = CONTAINER_TITLE_H + CONTAINER_PAD_Y;

  /** Count how many slots are needed at a given target column height. */
  function countSlots(target: number): number {
    let slots = 1, cy = 0;
    for (let gi = 0; gi < n; gi++) {
      const sg = sized[gi];
      const firstH = sg.chunks[0]?.estH ?? 0;
      // inter-container gap + orphan control (header + 1st chunk must fit)
      if (cy > 0) {
        if (cy + CONTAINER_GAP + headerH + firstH + CONTAINER_PAD_Y > target) {
          slots++; cy = 0;
        } else {
          cy += CONTAINER_GAP;
        }
      }
      cy += headerH;
      for (let ci = 0; ci < sg.chunks.length; ci++) {
        const chH = sg.chunks[ci].estH;
        if (cy + chH + CONTAINER_PAD_Y > target && cy > headerH + 0.1) {
          slots++; cy = headerH; // continuation header
        }
        cy += chH;
        if (ci < sg.chunks.length - 1) cy += CHUNK_GAP;
      }
      cy += CONTAINER_PAD_Y;
    }
    return slots;
  }

  // 1. Minimum slots at full capacity (usableH)
  const minSlots = countSlots(usableH);
  const pagesNeeded = Math.ceil(minSlots / colCount);
  const totalSlots = pagesNeeded * colCount;

  // 2. Binary search for the minimum target height that still fits in totalSlots
  const minTarget = headerH + Math.min(...sized.flatMap(g => g.chunks.map(c => c.estH))) + CONTAINER_PAD_Y;
  let lo = minTarget, hi = usableH;
  while (hi - lo > 0.1) {
    const mid = (lo + hi) / 2;
    if (countSlots(mid) <= totalSlots) hi = mid; else lo = mid;
  }
  const targetH = hi;

  // 3. Full flow to produce placements
  interface Placement {
    groupIdx: number;
    chunkIdx?: number; // undefined → header
    slot: number;
    y: number;
    height: number;
  }

  const placements: Placement[] = [];
  let slot = 0, cy = 0;

  for (let gi = 0; gi < n; gi++) {
    const sg = sized[gi];
    const firstH = sg.chunks[0]?.estH ?? 0;

    if (cy > 0) {
      if (cy + CONTAINER_GAP + headerH + firstH + CONTAINER_PAD_Y > targetH) {
        slot++; cy = 0;
      } else {
        cy += CONTAINER_GAP;
      }
    }

    // header
    placements.push({ groupIdx: gi, slot, y: cy, height: headerH });
    cy += headerH;

    for (let ci = 0; ci < sg.chunks.length; ci++) {
      const chH = sg.chunks[ci].estH;
      if (cy + chH + CONTAINER_PAD_Y > targetH && cy > headerH + 0.1) {
        slot++; cy = 0;
        // continuation header
        placements.push({ groupIdx: gi, slot, y: cy, height: headerH });
        cy += headerH;
      }
      placements.push({ groupIdx: gi, chunkIdx: ci, slot, y: cy, height: chH });
      cy += chH;
      if (ci < sg.chunks.length - 1) cy += CHUNK_GAP;
    }
    cy += CONTAINER_PAD_Y;
  }

  // 4. Assemble IContainer[] — one per (group, slot) segment
  const segKey = (gi: number, s: number) => `${gi}-${s}`;
  const segments = new Map<string, {
    groupIdx: number; slot: number; headerY: number;
    cps: Array<{ chunkIdx: number; y: number; height: number }>;
  }>();
  const segOrder: string[] = [];

  for (const p of placements) {
    const key = segKey(p.groupIdx, p.slot);
    if (!segments.has(key)) {
      segments.set(key, { groupIdx: p.groupIdx, slot: p.slot, headerY: p.y, cps: [] });
      segOrder.push(key);
    }
    if (p.chunkIdx !== undefined) {
      segments.get(key)!.cps.push({ chunkIdx: p.chunkIdx, y: p.y, height: p.height });
    }
  }

  const result: IContainer[] = [];
  let cidx = 0;

  for (const key of segOrder) {
    const seg = segments.get(key)!;
    if (seg.cps.length === 0) continue;

    const sg = sized[seg.groupIdx];
    const pg = Math.floor(seg.slot / colCount);
    const col = seg.slot % colCount;

    const cX = margin + col * (colW + COL_GAP);
    const cY = margin + seg.headerY;
    const last = seg.cps[seg.cps.length - 1];
    const containerH = (last.y + last.height + CONTAINER_PAD_Y) - seg.headerY;

    const chunkPositions: IChunkPosition[] = seg.cps.map(cp => ({
      nodeId: sg.chunks[cp.chunkIdx].nodeId,
      x: cX + CONTAINER_PAD_X,
      y: margin + cp.y,
      width: chunkW,
      height: cp.height,
    }));

    result.push({
      id: `container-${cidx++}`,
      parentNodeId: sg.parentNodeId,
      title: sg.title,
      page: pg,
      x: cX,
      y: cY,
      width: colW,
      height: containerH,
      chunks: chunkPositions,
    });
  }

  return { containers: result };
}
