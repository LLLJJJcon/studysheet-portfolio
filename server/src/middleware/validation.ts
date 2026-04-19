import { z } from 'zod';

// Recursive tree node schema
const baseNodeSchema = z.object({
  name: z.string(),
  sourceFile: z.string().optional(),
  importance: z.enum(['High-Frequency', 'Important', 'Awareness']).optional(),
});

type TreeNodeInput = z.infer<typeof baseNodeSchema> & {
  children?: TreeNodeInput[];
};

export const treeNodeSchema: z.ZodType<TreeNodeInput> = baseNodeSchema.extend({
  children: z.lazy(() => treeNodeSchema.array()).optional(),
});

export const l1OutputSchema = z.object({
  tree: treeNodeSchema,
});

// L2 chunk output
export const l2ChunkSchema = z.object({
  node_id: z.string(),
  content: z.string(),
  word_count: z.number(),
});

// L3 compression output
export const l3OutputSchema = z.object({
  compressed_chunks: z.array(
    z.object({
      node_id: z.string(),
      content: z.string(),
      word_count: z.number(),
    })
  ),
});

// Page config
export const pageConfigSchema = z.object({
  size: z.enum(['A4', '16:9', 'custom']),
  width: z.number().min(50).max(1000),
  height: z.number().min(50).max(1000),
  pages: z.number().min(1).max(20),
});

// Generation request
export const generateRequestSchema = z.object({
  courseId: z.string(),
});

// Chunk chat request
export const chunkChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(5000),
  })).max(20),
  chunkContext: z.object({
    content: z.string(),
    name: z.string(),
    importance: z.string(),
    treePath: z.string(),
    wordCount: z.number(),
    pageWordLimit: z.number(),
    chunkIndex: z.array(z.object({
      nodeId: z.string(),
      label: z.string(),
    })).max(200),
  }),
});
