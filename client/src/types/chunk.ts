export interface ChunkData {
  nodeId: string;
  content: string;
  wordCount: number;
  importance: string;
}

export interface ChunkPosition {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
