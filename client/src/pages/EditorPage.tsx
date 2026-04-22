import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DualView } from '../components/editor/DualView';
import { ContentTree } from '../components/tree/ContentTree';
import { LayoutCanvas } from '../components/canvas/LayoutCanvas';
import { CanvasRenderer } from '../components/canvas/CanvasRenderer';
import { GenerationStatus } from '../components/generation/GenerationStatus';
import { WordCounter } from '../components/generation/WordCounter';
import { FileUploader } from '../components/course/FileUploader';
import { VersionPanel } from '../components/version/VersionPanel';
import { SourceViewer } from '../components/canvas/SourceViewer';
import { Loading } from '../components/common/Loading';
import { useCourseStore } from '../stores/courseStore';
import { useGenerationStore } from '../stores/generationStore';
import { useTreeStore } from '../stores/treeStore';
import { useCanvasStore } from '../stores/canvasStore';
import { courseApi } from '../services/courseApi';
import { generationApi } from '../services/generationApi';
import { useAutoSave } from '../hooks/useAutoSave';
import { ChunkAIChat } from '../components/editor/ChunkAIChat';
import { MM_TO_PX } from '../utils/constants';

export const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fetchCourse = useCourseStore((s) => s.fetchCourse);
  const currentCourse = useCourseStore((s) => s.currentCourse);
  const phase = useGenerationStore((s) => s.phase);
  const setPhase = useGenerationStore((s) => s.setPhase);
  const setError = useGenerationStore((s) => s.setError);
  const setTotalWordCount = useGenerationStore((s) => s.setTotalWordCount);
  const appendStreamingContent = useGenerationStore((s) => s.appendStreamingContent);
  const setL2Progress = useGenerationStore((s) => s.setL2Progress);
  const addCompletedSubtree = useGenerationStore((s) => s.addCompletedSubtree);
  const setL3CurrentLevel = useGenerationStore((s) => s.setL3CurrentLevel);
  const incrementL3Compressed = useGenerationStore((s) => s.incrementL3Compressed);
  const addL3CompletedLevel = useGenerationStore((s) => s.addL3CompletedLevel);
  const setTree = useTreeStore((s) => s.setTree);
  const tree = useTreeStore((s) => s.tree);
  const [generating, setGenerating] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [showUploadArea, setShowUploadArea] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [relayouting, setRelayouting] = useState(false);
  const [localColumns, setLocalColumns] = useState<number>(0);
  const [localFontSize, setLocalFontSize] = useState<number>(0);
  const [sourceViewerNodeId, setSourceViewerNodeId] = useState<string | null>(null);
  const [detectedPages, setDetectedPages] = useState(1);
  const [pendingNewFileIds, setPendingNewFileIds] = useState<string[]>([]);
  const setMergeProgress = useGenerationStore((s) => s.setMergeProgress);
  const setMergeStatusText = useGenerationStore((s) => s.setMergeStatusText);

  const handlePagesDetected = useCallback((pages: number) => {
    setDetectedPages(pages);
  }, []);

  const handleExportPDF = useCallback(() => {
    const { containers, fontSize, lineHeight } = useCanvasStore.getState();
    const cols = localColumns || 3;
    const pConfig = currentCourse?.pageConfig || { width: 210, height: 297 };
    const marginMm = 5;

    // Build HTML content from orderedItems
    const onPage = containers.filter((c) => c.page >= 0).sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    const seenSections = new Set<string>();
    let htmlContent = '';
    for (const c of onPage) {
      if (!seenSections.has(c.parentNodeId)) {
        seenSections.add(c.parentNodeId);
        htmlContent += `<div class="section-title">${escapeHtmlStr(c.title)}</div>`;
      }
      for (const chunk of c.chunks) {
        const impClass = (chunk.importance || 'Important').toLowerCase().replace('-', '_');
        const content = chunk.content || '';
        // Handle images
        const imgMatch = content.match(/^!\[.*?\]\((.*?)\)$/);
        if (imgMatch) {
          htmlContent += `<div class="chunk ${impClass}"><img src="${escapeHtmlStr(imgMatch[1])}" style="max-width:100%;height:auto;" /></div>`;
        } else {
          htmlContent += `<div class="chunk ${impClass}">${escapeHtmlStr(content)}</div>`;
        }
      }
    }

    const printHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escapeHtmlStr(currentCourse?.name || 'StudySheet')}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
@page { size: ${pConfig.width}mm ${pConfig.height}mm; margin: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: ${fontSize}pt; line-height: ${lineHeight};
  color: #1a1a1a;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  padding: ${marginMm}mm;
  column-count: ${cols}; column-gap: 2mm; column-fill: balance;
}
.section-title {
  font-weight: 600; color: #6b7280; font-size: 9px; line-height: 14px;
  margin-bottom: 2px; break-after: avoid;
}
.chunk {
  border: 0.3pt solid #93c5fd; border-radius: 1pt;
  padding: 1px 2px; margin-bottom: 2px;
  background: #eff6ff; break-inside: avoid;
  white-space: pre-wrap; word-break: break-word;
}
.chunk.high_frequency { border-color: #fca5a5; background: #fef2f2; }
.chunk.important { border-color: #93c5fd; background: #eff6ff; }
.chunk.awareness { border-color: #d1d5db; background: #f9fafb; }
</style></head><body>${htmlContent}</body></html>`;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(printHTML);
      printWin.document.close();
      printWin.onload = () => { printWin.print(); };
    }
  }, [localColumns, currentCourse]);

  // Auto-save: creates version checkpoints on changes
  const { triggerSave } = useAutoSave({ courseId: id, enabled: !!tree });
  const initialLoadRef = useRef(true);

  // Subscribe to canvas container changes → persist layout + trigger version checkpoint
  useEffect(() => {
    if (!id || !tree) return;
    initialLoadRef.current = true;

    const unsub = useCanvasStore.subscribe(
      (s: { containers: unknown[] }) => s.containers,
      () => {
        if (initialLoadRef.current) { initialLoadRef.current = false; return; }
        const { containers, fontSize, lineHeight } = useCanvasStore.getState();
        generationApi.saveLayout(id, containers, fontSize, lineHeight);
        triggerSave();
      }
    );
    return unsub;
  }, [id, tree, triggerSave]);

  // Subscribe to tree changes → persist tree + trigger version checkpoint
  useEffect(() => {
    if (!id) return;
    let skipFirst = true;

    const unsub = useTreeStore.subscribe(
      (s: { tree: unknown }) => s.tree,
      (newTree: unknown) => {
        if (skipFirst) { skipFirst = false; return; }
        if (newTree) {
          generationApi.updateContentTree(id, newTree);
          triggerSave();
        }
      }
    );
    return unsub;
  }, [id, triggerSave]);

  // Sync local state from course on load
  useEffect(() => {
    if (currentCourse) {
      setLocalColumns(currentCourse.pageConfig?.columns || 0);
      setLocalFontSize(currentCourse.pageConfig?.fontSize || 0);
    }
  }, [currentCourse?.pageConfig?.columns, currentCourse?.pageConfig?.fontSize]);

  const handleRelayout = useCallback(async (opts: { columns?: number; fontSize?: number }) => {
    if (!id || relayouting) return;
    if (opts.columns !== undefined) setLocalColumns(opts.columns);
    if (opts.fontSize !== undefined) setLocalFontSize(opts.fontSize);
    setRelayouting(true);
    try {
      const layout = await generationApi.relayout(id, opts);
      if (layout) {
        useCanvasStore.getState().setLayout(layout.containers as any[], layout.fontSize, layout.lineHeight);
      }
    } catch { /* ignore */ } finally {
      setRelayouting(false);
    }
  }, [id, relayouting]);

  const handleShowSource = useCallback((nodeId: string) => {
    setSourceViewerNodeId(nodeId);
  }, []);

  useEffect(() => {
    if (id) {
      fetchCourse(id);
      // Reset all stores when entering a course
      useGenerationStore.getState().reset();
      useTreeStore.getState().setTree(null);
      useCanvasStore.getState().setLayout([], 7, 1.35);
    }
  }, [id, fetchCourse]);

  // Load persisted tree and layout when entering an already-generated course
  useEffect(() => {
    if (id && currentCourse && (currentCourse.status === 'editing' || currentCourse.status === 'generating')) {
      // Load content tree
      generationApi.fetchContentTree(id).then((treeData) => {
        if (treeData) {
          setTree(treeData as any);
        }
      });
      // Load layout
      generationApi.fetchLayout(id).then((layout) => {
        if (layout) {
          useCanvasStore.getState().setLayout(
            layout.containers as any[],
            layout.fontSize,
            layout.lineHeight
          );
        }
      });
    }
  }, [id, currentCourse?.status]);

  const handleDeleteFile = async (fileId: string) => {
    if (!id || deletingFileId) return;
    if (!confirm('Confirm delete this file?')) return;
    setDeletingFileId(fileId);
    try {
      await courseApi.removeFile(id, fileId);
      fetchCourse(id);
    } catch {
      console.error('Failed to delete file');
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleVersionRestored = () => {
    if (!id) return;
    fetchCourse(id);
    // Reload layout after restore
    generationApi.fetchLayout(id).then((layout) => {
      if (layout) {
        useCanvasStore.getState().setLayout(
          layout.containers as any[],
          layout.fontSize,
          layout.lineHeight
        );
      }
    });
  };

  const handleStartGeneration = async () => {
    if (!id || generating) return;
    if (tree && !confirm('Regenerating will overwrite current content,Confirm continue?')) return;
    setGenerating(true);
    setShowUploadArea(false);
    useGenerationStore.getState().resetStreamingContent();
    setPhase('l1:generating');

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const url = generationApi.getGenerateUrl(id);
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Generation failed' }));
        setError({ message: err.error || 'Generation failed', retryable: true });
        setGenerating(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let pendingEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            pendingEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (pendingEvent) {
                handleSSEEvent(pendingEvent, data);
                pendingEvent = '';
              } else if (data.event) {
                handleSSEEvent(data.event, data);
              }
            } catch { /* skip parse errors */ }
          }
        }
      }
    } catch (err) {
      setError({ message: 'Network error during generation', retryable: true });
    } finally {
      setGenerating(false);
    }
  };

  const handleSSEEvent = (event: string, data: Record<string, unknown>) => {
    switch (event) {
      case 'l1:start':
        setPhase('l1:generating');
        break;
      case 'l1:chunk':
        appendStreamingContent(data.partialJson as string || '');
        break;
      case 'l1:complete':
        setPhase('l1:complete');
        if (data.tree) setTree(data.tree as any);
        break;
      case 'l2:start':
        setPhase('l2:generating');
        useGenerationStore.getState().resetStreamingContent();
        break;
      case 'l2:chunk':
        appendStreamingContent(data.text as string || '');
        break;
      case 'l2:subtree-complete':
        addCompletedSubtree({
          subtreeName: data.subtreeName as string || '',
          chunkCount: data.chunkCount as number || 0,
        });
        setL2Progress(data.progress as number || 0);
        break;
      case 'l2:complete':
        setPhase('l2:complete');
        setTotalWordCount(data.totalWords as number || 0);
        break;
      case 'l3:start':
        setPhase('l3:compressing');
        break;
      case 'l3:level_compressing':
        setL3CurrentLevel(data.level as string || '');
        break;
      case 'l3:chunk_compressed':
        incrementL3Compressed();
        break;
      case 'l3:level_complete':
        addL3CompletedLevel(data.level as string || '');
        break;
      case 'l3:complete':
        setPhase('l3:complete');
        setTotalWordCount(data.finalWordCount as number || 0);
        break;
      case 'l4:start':
        setPhase('l4:layout');
        break;
      case 'l4:complete':
        setPhase('l4:complete');
        if (data.layout) {
          const layout = data.layout as { fontSize: number; lineHeight: number; containers: unknown[] };
          useCanvasStore.getState().setLayout(
            layout.containers as any[],
            layout.fontSize,
            layout.lineHeight
          );
        }
        break;
      case 'done':
        setPhase('done');
        if (id) fetchCourse(id); // Refresh course data
        break;
      case 'error':
        setError({ message: data.message as string || 'Generation error', retryable: data.retryable as boolean ?? false });
        break;
    }
  };

  const handleStartIncrementalMerge = async () => {
    if (!id || generating || pendingNewFileIds.length === 0) return;
    setGenerating(true);
    setShowUploadArea(false);
    useGenerationStore.getState().resetStreamingContent();
    setPhase('merge:running');
    setMergeProgress(0);
    setMergeStatusText('Starting incremental merge...');

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const url = generationApi.getIncrementalMergeUrl(id);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newFileIds: pendingNewFileIds }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Merge failed' }));
        setError({ message: err.error || 'Merge failed', retryable: true });
        setGenerating(false);
        // Keep pendingNewFileIds so the user can retry or switch to Full Regenerate.
        return;
      }

      let mergeSucceeded = false;
      const reader = response.body?.getReader();
      if (!reader) { setGenerating(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let pendingEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            pendingEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (pendingEvent) {
                if (pendingEvent === 'merge:complete') mergeSucceeded = true;
                handleMergeSSEEvent(pendingEvent, data);
                pendingEvent = '';
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setError({ message: 'Network error during merge', retryable: true });
    } finally {
      setGenerating(false);
      // Only clear pending uploads if the merge actually completed; otherwise
      // keep them so the user can retry without re-uploading.
      if (mergeSucceeded) setPendingNewFileIds([]);
    }
  };

  const handleMergeSSEEvent = (event: string, data: Record<string, unknown>) => {
    switch (event) {
      case 'merge:start':
        setMergeProgress(5);
        setMergeStatusText('Parsing new files...');
        break;
      case 'merge:new-generation-start':
        setMergeProgress(10);
        setMergeStatusText('Generating new content...');
        break;
      case 'merge:new-generation-complete':
        setMergeProgress(40);
        setMergeStatusText('New content generated. Comparing trees...');
        break;
      case 'merge:diff-start':
        setMergeProgress(45);
        setMergeStatusText('Comparing trees...');
        break;
      case 'merge:diff-complete':
        setMergeProgress(60);
        setMergeStatusText('Merge plan ready.');
        break;
      case 'merge:content-merge-start':
        setMergeProgress(62);
        setMergeStatusText('Merging content...');
        break;
      case 'merge:content-merge-progress': {
        const completed = data.completed as number || 0;
        const total = data.total as number || 1;
        const pct = 62 + Math.round((completed / total) * 13);
        setMergeProgress(pct);
        setMergeStatusText(`Merging content (${completed}/${total})...`);
        break;
      }
      case 'merge:executing':
        setMergeProgress(78);
        setMergeStatusText('Applying changes...');
        break;
      case 'merge:layout-start':
        setMergeProgress(85);
        setMergeStatusText('Updating layout...');
        break;
      case 'merge:complete':
        setMergeProgress(100);
        setMergeStatusText('Merge complete!');
        setPhase('done');
        if (data.tree) setTree(data.tree as any);
        if (data.layout) {
          const layout = data.layout as { fontSize: number; lineHeight: number; containers: unknown[] };
          useCanvasStore.getState().setLayout(
            layout.containers as any[], layout.fontSize, layout.lineHeight
          );
        }
        if (id) fetchCourse(id);
        break;
      case 'error':
        setError({ message: data.message as string || 'Merge error', retryable: data.retryable as boolean ?? false });
        break;
      case 'done':
        break;
    }
  };

  // Resolve source viewer data from nodeId (must be before early return to keep hook order stable)
  const sourceViewerData = useMemo(() => {
    if (!id || !sourceViewerNodeId) return null;
    const containers = useCanvasStore.getState().containers;
    let chunkContent = '';
    let sourceStart = '';
    let sourceEnd = '';
    let chunkSourceFiles: string[] = [];
    let sourceFileId = '';

    for (const c of containers) {
      const ch = c.chunks.find((ck: any) => ck.nodeId === sourceViewerNodeId);
      if (ch) {
        chunkContent = ch.content || '';
        sourceStart = ch.sourceStart || '';
        sourceEnd = ch.sourceEnd || '';
        chunkSourceFiles = (ch as any).sourceFiles || [];
        break;
      }
    }

    if (chunkSourceFiles.length > 0) {
      sourceFileId = chunkSourceFiles[0];
    } else {
      const findSrc = (node: any, target: string, parentSrc?: string): string | undefined => {
        const src = node.sourceFile || parentSrc;
        if (node.nodeId === target) return src;
        for (const child of node.children || []) {
          const found = findSrc(child, target, src);
          if (found) return found;
        }
      };
      if (tree) {
        sourceFileId = findSrc(tree, sourceViewerNodeId) || '';
      }
    }
    if (!sourceFileId) return null;
    return { courseId: id, sourceFile: sourceFileId, chunkContent, sourceStart, sourceEnd };
  }, [id, sourceViewerNodeId, tree]);

  if (!currentCourse) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading size="lg" message="Loading course..." />
      </div>
    );
  }

  const pageConfig = currentCourse.pageConfig;

  const leftPanel = (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={() => navigate('/courses')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {currentCourse.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/settings')}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {tree && (
            <button
              onClick={() => setVersionPanelOpen(true)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Version history"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          <WordCounter targetWordCount={pageConfig?.wordLimit} />
        </div>
      </div>

      {/* Layout controls */}
      {tree && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-gray-50 text-xs">
          <label className="flex items-center gap-1 text-gray-600">
            Number of columns
            <select
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white"
              value={localColumns}
              disabled={relayouting}
              onChange={(e) => handleRelayout({ columns: Number(e.target.value) })}
            >
              <option value={0}>Auto</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-gray-600">
            Font size
            <select
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white"
              value={localFontSize}
              disabled={relayouting}
              onChange={(e) => handleRelayout({ fontSize: Number(e.target.value) })}
            >
              <option value={0}>Auto</option>
              {[6, 7, 8, 9, 10, 11, 12].map((s) => (
                <option key={s} value={s}>{s}pt</option>
              ))}
            </select>
          </label>
          {relayouting && <span className="text-gray-400">Re-sorting…</span>}
          <div className="ml-auto">
            <button
              onClick={handleExportPDF}
              className="px-2 py-0.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
              title="Export PDF"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>
      )}

      {/* Generation status */}
      {phase !== 'idle' && (
        <div className="px-4 py-2">
          <GenerationStatus />
        </div>
      )}

      {/* Upload + Generate area (when no tree yet OR user toggled it) */}
      {(!tree && (phase === 'idle' || phase === 'error') || showUploadArea) && id && (
        <div className="px-4 py-4 space-y-3 border-b border-gray-200">
          <FileUploader courseId={id} onUploadComplete={(newFileIds) => { setPendingNewFileIds(newFileIds); fetchCourse(id); }} />

          {/* File list */}
          {currentCourse.files && currentCourse.files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">
                File uploaded ({currentCourse.files.length})
              </p>
              <ul className="space-y-1 max-h-40 overflow-auto">
                {currentCourse.files.map((f) => (
                  <li
                    key={f.fileId}
                    className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded text-sm group"
                  >
                    <span className="truncate flex-1 text-gray-700">{f.originalName}</span>
                    <button
                      onClick={() => handleDeleteFile(f.fileId)}
                      disabled={deletingFileId === f.fileId}
                      className="ml-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="Delete file"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              {tree && pendingNewFileIds.length > 0 ? (
                <div className="space-y-2">
                  <button
                    onClick={handleStartIncrementalMerge}
                    disabled={generating}
                    className="w-full py-2.5 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {generating ? 'Merging...' : 'Incremental Merge'}
                  </button>
                  <button
                    onClick={handleStartGeneration}
                    disabled={generating}
                    className="w-full py-1.5 px-4 text-xs text-gray-400 hover:text-gray-600"
                  >
                    Full Regenerate (overwrites current content)
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartGeneration}
                  disabled={generating}
                  className="w-full py-2.5 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {generating ? 'Generating...' : tree ? 'Regenerate' : 'Start generation'}
                </button>
              )}
              {showUploadArea && (
                <button
                  onClick={() => setShowUploadArea(false)}
                  className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600"
                >
                  Collapse
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Re-generate toggle (when tree exists but upload area is hidden) */}
      {tree && !showUploadArea && phase !== 'l1:generating' && phase !== 'l2:generating' && phase !== 'l3:compressing' && phase !== 'l4:layout' && (
        <div className="px-4 py-2 border-b border-gray-200">
          <button
            onClick={() => setShowUploadArea(true)}
            className="w-full py-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload file / Regenerate
          </button>
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-scroll px-4 py-2">
        <ContentTree />
      </div>
    </div>
  );

  const pageWidthMm = pageConfig?.width || 210;
  const pageWidthPx = Math.round(pageWidthMm * MM_TO_PX);

  const rightPanel = (
    <div className="h-full flex">
      <div className={`h-full overflow-hidden ${sourceViewerData ? 'flex-1 min-w-0' : 'w-full'}`}>
        <LayoutCanvas
          pageWidth={pageWidthMm}
          pageHeight={pageConfig?.height || 297}
          pages={detectedPages}
          targetPages={pageConfig?.pages}
        >
          <CanvasRenderer
            pageWidthPx={pageWidthPx}
            pageHeightPx={Math.round((pageConfig?.height || 297) * MM_TO_PX)}
            columns={localColumns}
            courseId={id}
            onShowSource={handleShowSource}
            onPagesDetected={handlePagesDetected}
          />
        </LayoutCanvas>
      </div>
      {sourceViewerData && (
        <div className="h-full flex-shrink-0" style={{ width: '40%', minWidth: 320, maxWidth: 600 }}>
          <SourceViewer
            key={sourceViewerData.sourceFile + ':' + sourceViewerData.sourceStart}
            courseId={sourceViewerData.courseId}
            sourceFile={sourceViewerData.sourceFile}
            chunkContent={sourceViewerData.chunkContent}
            sourceStart={sourceViewerData.sourceStart}
            sourceEnd={sourceViewerData.sourceEnd}
            onClose={() => setSourceViewerNodeId(null)}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen w-screen">
      <DualView leftPanel={leftPanel} rightPanel={rightPanel} />
      {id && (
        <>
          <VersionPanel
            courseId={id}
            isOpen={versionPanelOpen}
            onClose={() => setVersionPanelOpen(false)}
            onRestored={handleVersionRestored}
          />
          <ChunkAIChat courseId={id} />
        </>
      )}
    </div>
  );
};

function escapeHtmlStr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
