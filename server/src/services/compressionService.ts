import { LLMProvider } from '../llm/LLMProvider';
import { buildL3Prompt } from '../llm/prompts/L3_compression';
import { chunkService } from './chunkService';
import { countWords } from '../utils/wordCount';
import { IChunk } from '../models/Chunk';
import { withRetry } from '../middleware/errorHandler';

// Compression order: least important first
const COMPRESSION_ORDER = ['Awareness', 'Important', 'High-Frequency'];

interface CompressionResult {
  nodeId: string;
  originalWords: number;
  compressedWords: number;
  content: string;
}

export const compressionService = {
  /**
   * Run serial L3 compression pipeline.
   * Compresses chunks level by level (Awareness → Important → High-Frequency)
   * until total word count is within the word limit.
   */
  async compressChunks(
    courseId: string,
    wordLimit: number,
    provider: LLMProvider,
    onChunkCompressed?: (result: CompressionResult, level: string) => void,
    onLevelStart?: (level: string) => void,
    onLevelComplete?: (level: string) => void
  ): Promise<{ totalWords: number; compressed: boolean }> {
    let totalWords = await chunkService.getTotalWordCount(courseId);
    const threshold = wordLimit * 1.1;

    if (totalWords <= threshold) {
      return { totalWords, compressed: false };
    }

    let compressed = false;

    for (const level of COMPRESSION_ORDER) {
      if (totalWords <= threshold) break;

      onLevelStart?.(level);

      const chunks = await chunkService.getChunksByImportance(courseId, level);
      if (chunks.length === 0) {
        onLevelComplete?.(level);
        continue;
      }

      // Calculate how much we need to reduce
      const excessWords = totalWords - wordLimit;
      const levelTotalWords = chunks.reduce((sum, c) => sum + c.wordCount, 0);

      // Target reduction ratio for this level
      const targetReduction = Math.min(
        0.6, // Never reduce more than 60%
        excessWords / levelTotalWords
      );

      for (const chunk of chunks) {
        if (totalWords <= threshold) break;
        if (!chunk.content || chunk.wordCount === 0) continue;

        const messages = buildL3Prompt(
          level,
          chunk.nodeId,
          chunk.nodeId, // Using nodeId as name; the caller may improve this
          chunk.content,
          targetReduction
        );

        let compressedContent = '';
        try {
          compressedContent = await withRetry(
            async () => {
              let result = '';
              for await (const streamChunk of provider.chatStream({
                messages,
                temperature: 0.2,
              })) {
                if (streamChunk.content) {
                  result += streamChunk.content;
                }
              }
              return result;
            },
            { maxRetries: 2, baseDelay: 2000 }
          );
        } catch (err) {
          console.error(`L3 compression stream failed for chunk ${chunk.nodeId}:`, err instanceof Error ? err.message : err);
          continue; // Skip this chunk, keep original
        }

        const newWordCount = countWords(compressedContent);

        // Only accept compression if it actually reduced content
        if (newWordCount < chunk.wordCount) {
          const savedWords = chunk.wordCount - newWordCount;
          totalWords -= savedWords;

          await chunkService.upsertChunk(
            courseId,
            chunk.nodeId,
            compressedContent,
            newWordCount,
            level
          );

          compressed = true;

          onChunkCompressed?.(
            {
              nodeId: chunk.nodeId,
              originalWords: chunk.wordCount,
              compressedWords: newWordCount,
              content: compressedContent,
            },
            level
          );
        }
      }

      onLevelComplete?.(level);
    }

    return { totalWords, compressed };
  },
};
