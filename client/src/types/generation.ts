export type GenerationPhase =
  | 'idle'
  | 'l1:generating'
  | 'l1:complete'
  | 'l2:generating'
  | 'l2:complete'
  | 'l3:compressing'
  | 'l3:complete'
  | 'l4:layout'
  | 'l4:complete'
  | 'done'
  | 'error';

export interface SSEEvent {
  type: string;
  data: unknown;
}

export interface GenerationError {
  message: string;
  retryable: boolean;
}
