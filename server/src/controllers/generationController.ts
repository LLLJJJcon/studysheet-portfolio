import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import { generationOrchestrator } from '../services/generationOrchestrator';
import { User } from '../models/User';
import { Course } from '../models/Course';
import { ContentTree } from '../models/ContentTree';
import { createProvider } from '../llm/ProviderFactory';
import { buildL5SystemPrompt, buildL5UserMessage } from '../llm/prompts/L5_agentEditing';
import { agentTools } from '../llm/tools/agentTools';
import { executeToolCall } from '../llm/tools/toolExecutor';
import { layoutService } from '../services/layoutService';
import { chunkService } from '../services/chunkService';
import { calculateFontSize, getLineHeight } from '../utils/fontSizeCalc';
import { initSSE, sendSSE, endSSE, sendSSEError } from '../utils/sseHelper';
import { fileConversionService } from '../services/fileConversionService';
import { runChunkChatPipeline } from '../services/chunkChatService';
import { chunkChatSchema } from '../middleware/validation';

export const generationController = {
  async startGeneration(req: AuthRequest, res: Response): Promise<void> {
    const courseId = req.params.id;
    const userId = req.user!.userId;
    await generationOrchestrator.startGeneration(courseId, userId, res);
  },

  async getLayout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const userId = req.user!.userId;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      const layout = await layoutService.getLayout(courseId);
      if (!layout) {
        res.status(404).json({ error: 'No layout found' });
        return;
      }

      // Enrich layout containers with chunk content, importance, and name
      const allChunks = await chunkService.getChunksByCourse(courseId);
      const chunkMap = new Map(allChunks.map((c) => [c.nodeId, c]));

      // Build nodeId→name map from the content tree
      const contentTree = await ContentTree.findOne({ courseId });
      const nodeNames = new Map<string, string>();
      if (contentTree) {
        const collect = (node: { nodeId: string; name: string; children?: any[] }) => {
          nodeNames.set(node.nodeId, node.name);
          for (const ch of node.children || []) collect(ch);
        };
        collect(contentTree.tree as any);
      }

      const enrichedContainers = layout.containers.map((container) => ({
        id: container.id,
        parentNodeId: container.parentNodeId,
        title: container.title,
        page: container.page,
        x: container.x,
        y: container.y,
        width: container.width,
        height: container.height,
        chunks: container.chunks.map((chunk) => {
          const chunkData = chunkMap.get(chunk.nodeId);
          return {
            nodeId: chunk.nodeId,
            x: chunk.x,
            y: chunk.y,
            width: chunk.width,
            height: chunk.height,
            content: chunkData?.content || '',
            importance: chunkData?.importance || 'Important',
            name: nodeNames.get(chunk.nodeId) || '',
            sourceStart: chunkData?.sourceStart || '',
            sourceEnd: chunkData?.sourceEnd || '',
          };
        }),
      }));

      res.json({
        layout: {
          fontSize: layout.fontSize,
          lineHeight: layout.lineHeight,
          containers: enrichedContainers,
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to get layout' });
    }
  },

  async getContentTree(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const userId = req.user!.userId;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }

      const contentTree = await ContentTree.findOne({ courseId });
      if (!contentTree) {
        res.status(404).json({ error: 'No content tree found' });
        return;
      }

      res.json({ tree: contentTree.tree });
    } catch {
      res.status(500).json({ error: 'Failed to get content tree' });
    }
  },

  async cmdK(req: AuthRequest, res: Response): Promise<void> {
    const courseId = req.params.id;
    const userId = req.user!.userId;
    const { instruction } = req.body;

    if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
      res.status(400).json({ error: 'instruction is required' });
      return;
    }

    initSSE(res);

    try {
      const user = await User.findById(userId);
      if (!user) {
        sendSSEError(res, 'User not found', false);
        return;
      }

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        sendSSEError(res, 'Course not found', false);
        return;
      }

      const provider = createProvider(user);
      sendSSE(res, 'cmdk:start', { instruction });

      // Build messages
      const systemMessage = buildL5SystemPrompt(course.name);
      const userMessage = buildL5UserMessage(instruction);

      const messages = [systemMessage, userMessage];

      // Agent loop: LLM calls tools, backend executes, feeds results back
      let iteration = 0;
      const MAX_ITERATIONS = 10;

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        sendSSE(res, 'cmdk:thinking', { iteration });

        let finalText = '';
        const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

        for await (const event of provider.chatWithTools({
          messages,
          tools: agentTools,
          temperature: 0.3,
        })) {
          if (event.type === 'text' && event.content) {
            finalText += event.content;
          } else if (event.type === 'tool_call' && event.toolCall) {
            toolCalls.push(event.toolCall);
          }
        }

        // If no tool calls, the agent is done and finalText contains the JSON
        if (toolCalls.length === 0) {
          // Parse changes from final text
          const changes = parseChanges(finalText);
          sendSSE(res, 'cmdk:changes', { changes });
          endSSE(res);
          return;
        }

        // Execute tool calls and feed results back
        for (const tc of toolCalls) {
          sendSSE(res, 'cmdk:tool_call', { name: tc.name, id: tc.id });

          const result = await executeToolCall(
            { id: tc.id, name: tc.name, arguments: tc.arguments },
            courseId
          );

          sendSSE(res, 'cmdk:tool_result', { name: tc.name, id: tc.id });

          // Add assistant message with tool calls and tool result to messages
          messages.push({
            role: 'assistant',
            content: `[Tool call: ${tc.name}(${tc.arguments})]`,
          });
          messages.push({
            role: 'user',
            content: `[Tool result for ${tc.name}]: ${result}`,
          });
        }
      }

      // Max iterations reached
      sendSSE(res, 'cmdk:changes', { changes: [] });
      endSSE(res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      sendSSEError(res, message, true);
    }
  },

  async relayout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const userId = req.user!.userId;
      const { columns, fontSize: userFontSize } = req.body;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) { res.status(404).json({ error: 'Course not found' }); return; }

      const contentTree = await ContentTree.findOne({ courseId });
      if (!contentTree) { res.status(404).json({ error: 'No content tree found' }); return; }

      const allChunks = await chunkService.getChunksByCourse(courseId);
      if (!allChunks.length) { res.status(404).json({ error: 'No chunks found' }); return; }

      // Update course pageConfig
      if (columns !== undefined) course.pageConfig.columns = columns || undefined;
      if (userFontSize !== undefined) course.pageConfig.fontSize = userFontSize || undefined;
      await course.save();

      const pageConfig = course.pageConfig;
      const totalWords = allChunks.reduce((sum, c) => sum + (c.content?.length || 0), 0);
      const fs = pageConfig.fontSize || calculateFontSize(totalWords, pageConfig.wordLimit);
      const lh = getLineHeight(fs);

      const layout = await layoutService.generateLayout(
        courseId,
        allChunks,
        contentTree.tree,
        pageConfig,
        fs,
        lh,
        null as any // provider not needed for algorithmic layout
      );

      // Enrich with content, importance, name
      const chunkMap = new Map(allChunks.map((c) => [c.nodeId, c]));
      const nodeNames = new Map<string, string>();
      const collect = (node: { nodeId: string; name: string; children?: any[] }) => {
        nodeNames.set(node.nodeId, node.name);
        for (const ch of node.children || []) collect(ch);
      };
      collect(contentTree.tree as any);

      const enrichedContainers = layout.containers.map((container) => ({
        id: container.id,
        parentNodeId: container.parentNodeId,
        title: container.title,
        page: container.page,
        x: container.x,
        y: container.y,
        width: container.width,
        height: container.height,
        chunks: container.chunks.map((chunk) => {
          const chunkData = chunkMap.get(chunk.nodeId);
          return {
            nodeId: chunk.nodeId,
            x: chunk.x, y: chunk.y, width: chunk.width, height: chunk.height,
            content: chunkData?.content || '',
            importance: chunkData?.importance || 'Important',
            name: nodeNames.get(chunk.nodeId) || '',
            sourceStart: chunkData?.sourceStart || '',
            sourceEnd: chunkData?.sourceEnd || '',
          };
        }),
      }));

      res.json({
        layout: { fontSize: layout.fontSize, lineHeight: layout.lineHeight, containers: enrichedContainers },
      });
    } catch {
      res.status(500).json({ error: 'Failed to relayout' });
    }
  },

  async optimizeLayout(req: AuthRequest, res: Response): Promise<void> {
    const courseId = req.params.id;
    const userId = req.user!.userId;

    initSSE(res);

    try {
      const user = await User.findById(userId);
      if (!user) {
        sendSSEError(res, 'User not found', false);
        return;
      }

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        sendSSEError(res, 'Course not found', false);
        return;
      }

      const contentTree = await ContentTree.findOne({ courseId });
      if (!contentTree) {
        sendSSEError(res, 'Content tree not found. Generate content first.', false);
        return;
      }

      const provider = createProvider(user);
      const pageConfig = course.pageConfig || { size: 'A4', width: 210, height: 297, pages: 1 };

      sendSSE(res, 'optimize:start', {});

      const layout = await layoutService.getLayout(courseId);
      if (!layout) {
        sendSSEError(res, 'No layout found. Generate content first.', false);
        return;
      }

      const optimized = await layoutService.optimizeLayout(
        courseId,
        contentTree.tree,
        pageConfig,
        layout.fontSize,
        provider
      );

      if (optimized) {
        sendSSE(res, 'optimize:complete', {
          containers: optimized.containers,
          fontSize: optimized.fontSize,
          lineHeight: optimized.lineHeight,
        });
      }

      endSSE(res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      sendSSEError(res, message, true);
    }
  },

  async updateChunk(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const nodeId = req.params.nodeId;
      const userId = req.user!.userId;
      const { content } = req.body;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) { res.status(404).json({ error: 'Course not found' }); return; }

      if (typeof content !== 'string') {
        res.status(400).json({ error: 'content is required' });
        return;
      }

      const wordCount = content.length;
      await chunkService.upsertChunk(courseId, nodeId, content, wordCount, 'Important');
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update chunk' });
    }
  },

  async updateContentTree(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const userId = req.user!.userId;
      const { tree } = req.body;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) { res.status(404).json({ error: 'Course not found' }); return; }

      if (!tree) { res.status(400).json({ error: 'tree is required' }); return; }

      await ContentTree.findOneAndUpdate(
        { courseId },
        { tree },
        { upsert: true }
      );
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update content tree' });
    }
  },

  async getSourceFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const fileId = req.params.fileId;
      const userId = req.user!.userId;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) { res.status(404).json({ error: 'Course not found' }); return; }

      const file = course.files.find((f) => f.fileId === fileId || f.originalName === fileId);
      if (!file) { res.status(404).json({ error: 'File not found' }); return; }

      res.json({
        filename: file.originalName,
        content: file.extractedText,
        mimeType: file.mimeType,
        fileId: file.fileId,
      });
    } catch {
      res.status(500).json({ error: 'Failed to get source file' });
    }
  },

  async getRawFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const fileId = req.params.fileId;
      const userId = req.user!.userId;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) { res.status(404).json({ error: 'Course not found' }); return; }

      const file = course.files.find((f) => f.fileId === fileId || f.originalName === fileId);
      if (!file) { res.status(404).json({ error: 'File not found' }); return; }

      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      const filePath = path.resolve(uploadDir, file.filename);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Original file not found on disk' });
        return;
      }

      // For PPT/PPTX/DOC/DOCX, convert to PDF and serve that instead
      if (fileConversionService.isConvertible(file.mimeType)) {
        const pdfPath = await fileConversionService.getPdfPath(filePath);
        if (pdfPath) {
          const pdfName = file.originalName.replace(/\.[^.]+$/, '.pdf');
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pdfName)}"`);
          fs.createReadStream(pdfPath).pipe(res);
          return;
        }
        // Conversion failed — fall through to serve original
      }

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.status(500).json({ error: 'Failed to serve file' });
    }
  },

  async saveLayout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const userId = req.user!.userId;
      const { containers, fontSize, lineHeight } = req.body;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) { res.status(404).json({ error: 'Course not found' }); return; }

      if (!Array.isArray(containers)) {
        res.status(400).json({ error: 'containers array is required' });
        return;
      }

      await layoutService.updateLayout(courseId, containers);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to save layout' });
    }
  },

  async uploadImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const courseId = req.params.id;
      const userId = req.user!.userId;

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) { res.status(404).json({ error: 'Course not found' }); return; }

      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }

      const url = `/api/uploads/${file.filename}`;
      res.json({ url, filename: file.originalname });
    } catch {
      res.status(500).json({ error: 'Failed to upload image' });
    }
  },
  async chunkChat(req: AuthRequest, res: Response): Promise<void> {
    const courseId = req.params.id;
    const nodeId = req.params.nodeId;
    const userId = req.user!.userId;

    const parsed = chunkChatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
      return;
    }

    const { messages, chunkContext } = parsed.data;

    initSSE(res);

    try {
      const user = await User.findById(userId);
      if (!user) {
        sendSSEError(res, 'User not found', false);
        return;
      }

      const course = await Course.findOne({ _id: courseId, userId });
      if (!course) {
        sendSSEError(res, 'Course not found', false);
        return;
      }

      const provider = createProvider(user);

      await runChunkChatPipeline(res, provider, courseId, nodeId, messages, chunkContext);

      endSSE(res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      sendSSEError(res, message, false);
    }
  },
};

function parseChanges(text: string): unknown[] {
  // Extract JSON block from the text
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr.trim());
    if (parsed.changes && Array.isArray(parsed.changes)) {
      return parsed.changes;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    // Try to find any JSON array in the text
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
}
