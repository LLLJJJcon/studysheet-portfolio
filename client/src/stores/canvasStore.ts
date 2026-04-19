import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface Container {
  id: string;
  parentNodeId: string;
  title: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  chunks: ChunkPosition[];
}

export interface ChunkPosition {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  importance?: string;
  name?: string;
  sourceStart?: string;
  sourceEnd?: string;
}

interface CanvasState {
  containers: Container[];
  fontSize: number;
  lineHeight: number;
  selectedChunkId: string | null;
  selectedContainerId: string | null;
  highlightedChunkId: string | null;
  scale: number;

  setLayout: (containers: Container[], fontSize: number, lineHeight: number) => void;
  setSelectedChunkId: (id: string | null) => void;
  setSelectedContainerId: (id: string | null) => void;
  setHighlightedChunkId: (id: string | null) => void;
  setScale: (scale: number) => void;

  updateChunkPosition: (nodeId: string, x: number, y: number) => void;
  updateChunkSize: (nodeId: string, width: number, height: number, dx: number, dy: number) => void;
  setChunkBoxSize: (nodeId: string, width?: number, height?: number) => void;
  updateChunkContent: (nodeId: string, content: string) => void;
  deleteChunk: (nodeId: string) => void;
  moveChunkToStaging: (nodeId: string) => void;
  swapChunks: (nodeIdA: string, nodeIdB: string) => void;
  moveChunk: (draggedNodeId: string, targetNodeId: string, position: 'before' | 'after') => void;
  moveChunkToParentContainer: (nodeId: string, targetParentNodeId: string) => void;
  addChunk: (nodeId: string, content: string, importance: string, afterNodeId?: string) => void;
}

export const useCanvasStore = create<CanvasState>()(subscribeWithSelector((set) => ({
  containers: [],
  fontSize: 7,
  lineHeight: 1.35,
  selectedChunkId: null,
  selectedContainerId: null,
  highlightedChunkId: null,
  scale: 1,

  setLayout: (containers, fontSize, lineHeight) =>
    set({ containers, fontSize, lineHeight }),

  setSelectedChunkId: (id) => set({ selectedChunkId: id }),
  setSelectedContainerId: (id) => set({ selectedContainerId: id }),
  setHighlightedChunkId: (id) => set({ highlightedChunkId: id }),
  setScale: (scale) => set({ scale }),

  updateChunkPosition: (nodeId, x, y) =>
    set((state) => ({
      containers: state.containers.map((container) => ({
        ...container,
        chunks: container.chunks.map((chunk) =>
          chunk.nodeId === nodeId ? { ...chunk, x, y } : chunk
        ),
      })),
    })),

  updateChunkSize: (nodeId, width, height, dx, dy) =>
    set((state) => ({
      containers: state.containers.map((container) => ({
        ...container,
        chunks: container.chunks.map((chunk) =>
          chunk.nodeId === nodeId
            ? { ...chunk, width, height, x: chunk.x + dx, y: chunk.y + dy }
            : chunk
        ),
      })),
    })),

    setChunkBoxSize: (nodeId, width, height) =>
    set((state) => ({
      containers: state.containers.map((container) => ({
        ...container,
        chunks: container.chunks.map((chunk) =>
            chunk.nodeId === nodeId
              ? {
                  ...chunk,
                  ...(width !== undefined ? { width } : {}),
                  ...(height !== undefined ? { height } : {}),
                }
              : chunk
        ),
      })),
    })),

  deleteChunk: (nodeId) =>
    set((state) => ({
      containers: state.containers.map((container) => ({
        ...container,
        chunks: container.chunks.filter((chunk) => chunk.nodeId !== nodeId),
      })),
    })),

  updateChunkContent: (nodeId, content) =>
    set((state) => ({
      containers: state.containers.map((container) => ({
        ...container,
        chunks: container.chunks.map((chunk) =>
          chunk.nodeId === nodeId ? { ...chunk, content } : chunk
        ),
      })),
    })),

  moveChunkToStaging: (nodeId) =>
    set((state) => {
      let movedChunk: ChunkPosition | null = null;
      const updatedContainers = state.containers.map((container) => {
        const chunk = container.chunks.find((c) => c.nodeId === nodeId);
        if (chunk) {
          movedChunk = { ...chunk };
          return {
            ...container,
            chunks: container.chunks.filter((c) => c.nodeId !== nodeId),
          };
        }
        return container;
      });

      if (movedChunk) {
        // Find or create staging container (page === -1)
        let stagingContainer = updatedContainers.find((c) => c.page === -1);
        if (!stagingContainer) {
          stagingContainer = {
            id: 'staging',
            parentNodeId: 'staging',
            title: 'Staging area',
            page: -1,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            chunks: [],
          };
          updatedContainers.push(stagingContainer);
        }
        stagingContainer.chunks.push(movedChunk);
      }

      return { containers: updatedContainers };
    }),

  swapChunks: (nodeIdA, nodeIdB) =>
    set((state) => {
      // Find both chunks' positions across all containers
      let foundA: { ci: number; chi: number } | null = null;
      let foundB: { ci: number; chi: number } | null = null;
      for (let ci = 0; ci < state.containers.length; ci++) {
        const c = state.containers[ci];
        for (let chi = 0; chi < c.chunks.length; chi++) {
          if (c.chunks[chi].nodeId === nodeIdA) foundA = { ci, chi };
          if (c.chunks[chi].nodeId === nodeIdB) foundB = { ci, chi };
        }
      }
      if (!foundA || !foundB) return {};
      const posA = foundA;
      const posB = foundB;

      const newContainers = state.containers.map((c) => ({ ...c, chunks: [...c.chunks] }));
      const chA = { ...newContainers[posA.ci].chunks[posA.chi] };
      const chB = { ...newContainers[posB.ci].chunks[posB.chi] };

      // Swap data (nodeId, content, importance, name) but keep positions
      const dataA = { nodeId: chA.nodeId, content: chA.content, importance: chA.importance, name: chA.name };
      const dataB = { nodeId: chB.nodeId, content: chB.content, importance: chB.importance, name: chB.name };
      newContainers[posA.ci].chunks[posA.chi] = { ...chA, ...dataB };
      newContainers[posB.ci].chunks[posB.chi] = { ...chB, ...dataA };

      return { containers: newContainers };
    }),

  moveChunk: (draggedNodeId, targetNodeId, position) =>
    set((state) => {
      // Find both chunks before mutating
      let draggedChunk: ChunkPosition | null = null;
      let dragContainerIdx = -1;
      let dragChunkIdx = -1;
      let targetContainerIdx = -1;
      let targetChunkIdx = -1;

      for (let ci = 0; ci < state.containers.length; ci++) {
        const c = state.containers[ci];
        for (let chi = 0; chi < c.chunks.length; chi++) {
          if (c.chunks[chi].nodeId === draggedNodeId) {
            dragContainerIdx = ci;
            dragChunkIdx = chi;
            draggedChunk = { ...c.chunks[chi] };
          }
          if (c.chunks[chi].nodeId === targetNodeId) {
            targetContainerIdx = ci;
            targetChunkIdx = chi;
          }
        }
      }

      if (!draggedChunk || targetContainerIdx === -1 || targetChunkIdx === -1) return {};

      const newContainers = state.containers.map((c) => ({ ...c, chunks: [...c.chunks] }));

      // Same container: just reorder
      if (dragContainerIdx === targetContainerIdx) {
        const chunks = newContainers[dragContainerIdx].chunks;
        chunks.splice(dragChunkIdx, 1);
        // Recalculate target index after removal
        const newTargetIdx = chunks.findIndex((ch) => ch.nodeId === targetNodeId);
        if (newTargetIdx === -1) return {};
        const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;
        chunks.splice(insertIdx, 0, draggedChunk);
      } else {
        // Different containers: remove from source, insert into target
        newContainers[dragContainerIdx].chunks.splice(dragChunkIdx, 1);
        const targetChunks = newContainers[targetContainerIdx].chunks;
        const insertIdx = position === 'before' ? targetChunkIdx : targetChunkIdx + 1;
        targetChunks.splice(insertIdx, 0, draggedChunk);
      }

      return { containers: newContainers };
    }),

  moveChunkToParentContainer: (nodeId, targetParentNodeId) =>
    set((state) => {
      let sourceContainerIdx = -1;
      let sourceChunkIdx = -1;
      let movedChunk: ChunkPosition | null = null;

      for (let ci = 0; ci < state.containers.length; ci++) {
        const chunkIdx = state.containers[ci].chunks.findIndex((ch) => ch.nodeId === nodeId);
        if (chunkIdx !== -1) {
          sourceContainerIdx = ci;
          sourceChunkIdx = chunkIdx;
          movedChunk = { ...state.containers[ci].chunks[chunkIdx] };
          break;
        }
      }

      if (!movedChunk) return {};

      const targetContainerIdx = state.containers.findIndex(
        (c) => c.parentNodeId === targetParentNodeId && c.page >= 0
      );

      if (targetContainerIdx === -1) return {};
      if (sourceContainerIdx === targetContainerIdx) return {};

      const newContainers = state.containers.map((c) => ({ ...c, chunks: [...c.chunks] }));
      newContainers[sourceContainerIdx].chunks.splice(sourceChunkIdx, 1);
      newContainers[targetContainerIdx].chunks.push(movedChunk);

      return { containers: newContainers };
    }),

  addChunk: (nodeId, content, importance, afterNodeId) =>
    set((state) => {
      const newChunk: ChunkPosition = {
        nodeId,
        x: 0, y: 0, width: 60, height: 10,
        content,
        importance,
        name: '',
      };

      if (!afterNodeId) {
        // Add to the first on-page container
        const containerIdx = state.containers.findIndex((c) => c.page >= 0);
        if (containerIdx === -1) return {};
        const newContainers = state.containers.map((c, i) => {
          if (i === containerIdx) return { ...c, chunks: [...c.chunks, newChunk] };
          return c;
        });
        return { containers: newContainers };
      }

      // First try: insert after the specified chunk
      let found = false;
      const newContainers = state.containers.map((c) => {
        const idx = c.chunks.findIndex((ch) => ch.nodeId === afterNodeId);
        if (idx !== -1) {
          found = true;
          const newChunks = [...c.chunks];
          newChunks.splice(idx + 1, 0, newChunk);
          return { ...c, chunks: newChunks };
        }
        return c;
      });
      if (found) return { containers: newContainers };

      // Fallback: if afterNodeId is a container's parentNodeId, add to end of that container
      const containerIdx = state.containers.findIndex(
        (c) => c.parentNodeId === afterNodeId && c.page >= 0
      );
      if (containerIdx !== -1) {
        return {
          containers: state.containers.map((c, i) => {
            if (i === containerIdx) return { ...c, chunks: [...c.chunks, newChunk] };
            return c;
          }),
        };
      }

      return {};
    }),
})));
