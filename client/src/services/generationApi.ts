const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface CmdKChange {
  type: 'update_content' | 'delete_node' | 'add_node' | 'update_importance';
  nodeId: string;
  parentNodeId?: string;
  name?: string;
  oldContent?: string;
  newContent?: string;
  oldImportance?: string;
  newImportance?: string;
  importance?: string;
  reason?: string;
}

export type CmdKEventHandler = {
  onStart?: () => void;
  onThinking?: (iteration: number) => void;
  onToolCall?: (name: string) => void;
  onChanges?: (changes: CmdKChange[]) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

// Generation API client for cheat sheet generation, layout, content tree, and Cmd+K operations
export const generationApi = {
  getGenerateUrl(courseId: string): string {
    return `${API_URL}/courses/${courseId}/generate`;
  },
  getCmdKUrl(courseId: string): string {
    return `${API_URL}/courses/${courseId}/cmd-k`;
  },
  getOptimizeLayoutUrl(courseId: string): string {
    return `${API_URL}/courses/${courseId}/optimize-layout`;
  },
  getIncrementalMergeUrl(courseId: string): string {
    return `${API_URL}/courses/${courseId}/incremental-merge`;
  },

  async cancelGeneration(courseId: string): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const response = await fetch(`${API_URL}/courses/${courseId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async uploadImage(courseId: string, file: File): Promise<{ url: string; filename: string } | null> {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch(`${API_URL}/courses/${courseId}/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  async saveVersion(courseId: string, label: string, description?: string): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const response = await fetch(`${API_URL}/courses/${courseId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label, description }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async fetchLayout(courseId: string): Promise<{ fontSize: number; lineHeight: number; containers: unknown[] } | null> {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const response = await fetch(`${API_URL}/courses/${courseId}/layout`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.layout || null;
  },

  async fetchContentTree(courseId: string): Promise<unknown | null> {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const response = await fetch(`${API_URL}/courses/${courseId}/content-tree`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.tree || null;
  },

  async relayout(courseId: string, options: { columns?: number; fontSize?: number }): Promise<{ fontSize: number; lineHeight: number; containers: unknown[] } | null> {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const response = await fetch(`${API_URL}/courses/${courseId}/relayout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(options),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.layout || null;
  },

  async updateChunkContent(courseId: string, nodeId: string, content: string): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const response = await fetch(`${API_URL}/courses/${courseId}/chunks/${encodeURIComponent(nodeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async updateContentTree(courseId: string, tree: unknown): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const response = await fetch(`${API_URL}/courses/${courseId}/content-tree`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tree }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async saveLayout(courseId: string, containers: unknown[], fontSize: number, lineHeight: number): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      // Strip content/importance/name from chunks before saving - Layout model only stores positions
      const stripped = (containers as any[]).map(c => ({
        id: c.id,
        parentNodeId: c.parentNodeId,
        title: c.title,
        page: c.page,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
        chunks: c.chunks.map((ch: any) => ({
          nodeId: ch.nodeId,
          x: ch.x,
          y: ch.y,
          width: ch.width,
          height: ch.height,
        })),
      }));
      const response = await fetch(`${API_URL}/courses/${courseId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ containers: stripped, fontSize, lineHeight }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async getSourceFile(courseId: string, fileId: string): Promise<{ filename: string; content: string; mimeType?: string; fileId?: string } | null> {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const response = await fetch(`${API_URL}/courses/${courseId}/source-file/${encodeURIComponent(fileId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  getRawFileUrl(courseId: string, fileId: string): string {
    return `${API_URL}/courses/${courseId}/files/${encodeURIComponent(fileId)}/raw`;
  },

  /**
   * Send a Cmd+K instruction and stream SSE events.
   */
  async sendCmdK(
    courseId: string,
    instruction: string,
    token: string,
    handlers: CmdKEventHandler
  ): Promise<void> {
    const url = this.getCmdKUrl(courseId);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ instruction }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      handlers.onError?.(err.error || 'Request failed');
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      handlers.onError?.('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ') && eventType) {
          const data = JSON.parse(line.slice(6));
          switch (eventType) {
            case 'cmdk:start':
              handlers.onStart?.();
              break;
            case 'cmdk:thinking':
              handlers.onThinking?.(data.iteration);
              break;
            case 'cmdk:tool_call':
              handlers.onToolCall?.(data.name);
              break;
            case 'cmdk:changes':
              handlers.onChanges?.(data.changes || []);
              break;
            case 'error':
              handlers.onError?.(data.message);
              break;
            case 'done':
              handlers.onDone?.();
              break;
          }
          eventType = '';
        }
      }
    }

    handlers.onDone?.();
  },
};
