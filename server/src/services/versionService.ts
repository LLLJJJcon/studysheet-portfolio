import { Version, IVersion } from '../models/Version';
import { ContentTree } from '../models/ContentTree';
import { Layout } from '../models/Layout';
import { Chunk } from '../models/Chunk';

const MAX_AUTO_SAVE_VERSIONS = 20;

// Service for saving, restoring, and managing versioned snapshots of course content
export const versionService = {
  /**
   * Create an auto-save snapshot of the current state.
   * Maintains a rolling window of MAX_AUTO_SAVE_VERSIONS.
   */
  // Snapshot the current tree, layout, and chunks as a new version with auto-pruning
  async autoSave(courseId: string, label?: string, description?: string): Promise<IVersion> {
    const [tree, layout, chunks] = await Promise.all([
      ContentTree.findOne({ courseId }),
      Layout.findOne({ courseId }),
      Chunk.find({ courseId }).lean(),
    ]);

    if (!tree || !layout) {
      throw new Error('Cannot save version: tree or layout not found');
    }

    // Get next version number
    const latestVersion = await Version.findOne({ courseId })
      .sort({ versionNumber: -1 })
      .select('versionNumber');
    const nextNumber = (latestVersion?.versionNumber || 0) + 1;

    const version = await Version.create({
      courseId,
      versionNumber: nextNumber,
      label: label || `Auto-save #${nextNumber}`,
      description: description || '',
      isBaseline: false,
      treeSnapshot: tree.tree,
      layoutSnapshot: {
        fontSize: layout.fontSize,
        lineHeight: layout.lineHeight,
        containers: layout.containers,
      },
      chunksSnapshot: chunks.map((c) => ({
        nodeId: c.nodeId,
        content: c.content,
        wordCount: c.wordCount,
        importance: c.importance,
      })),
    });

    // Prune old non-baseline auto-save versions
    const oldVersions = await Version.find({
      courseId,
      isBaseline: false,
    })
      .sort({ versionNumber: -1 })
      .skip(MAX_AUTO_SAVE_VERSIONS)
      .select('_id');

    if (oldVersions.length > 0) {
      await Version.deleteMany({
        _id: { $in: oldVersions.map((v) => v._id) },
      });
    }

    return version;
  },

  /**
   * Mark a version as a baseline (protected from auto-pruning).
   */
  // Mark a version as baseline so it is protected from auto-pruning
  async markBaseline(
    courseId: string,
    versionId: string,
    label?: string
  ): Promise<IVersion | null> {
    return Version.findOneAndUpdate(
      { _id: versionId, courseId },
      { isBaseline: true, ...(label ? { label } : {}) },
      { new: true }
    );
  },

  /**
   * Get all versions for a course, sorted by version number descending.
   */
  // List all versions for a course sorted by version number descending
  async getVersions(courseId: string): Promise<IVersion[]> {
    return Version.find({ courseId })
      .sort({ versionNumber: -1 })
      .select('versionNumber label description isBaseline createdAt');
  },

  /**
   * Get a specific version with full snapshots.
   */
  // Retrieve a specific version with full snapshot data
  async getVersion(
    courseId: string,
    versionId: string
  ): Promise<IVersion | null> {
    return Version.findOne({ _id: versionId, courseId });
  },

  /**
   * Restore a version: overwrite current tree, layout, and chunks.
   */
  // Restore a version by overwriting the current tree, layout, and chunks
  async restoreVersion(courseId: string, versionId: string): Promise<void> {
    const version = await Version.findOne({ _id: versionId, courseId });
    if (!version) {
      throw new Error('Version not found');
    }

    // Auto-save current state before restoring
    try {
      await this.autoSave(courseId, 'Auto-save before restoration');
    } catch {
      // Ignore if current state can't be saved
    }

    // Restore tree
    await ContentTree.findOneAndUpdate(
      { courseId },
      { tree: version.treeSnapshot },
      { upsert: true }
    );

    // Restore layout
    const layoutData = version.layoutSnapshot as {
      fontSize: number;
      lineHeight: number;
      containers: unknown[];
    };
    await Layout.findOneAndUpdate(
      { courseId },
      {
        fontSize: layoutData.fontSize,
        lineHeight: layoutData.lineHeight,
        containers: layoutData.containers,
      },
      { upsert: true }
    );

    // Restore chunks
    await Chunk.deleteMany({ courseId });
    if (version.chunksSnapshot.length > 0) {
      const chunksToInsert = version.chunksSnapshot.map((c) => ({
        courseId,
        nodeId: c.nodeId,
        content: c.content,
        wordCount: c.wordCount,
        importance: c.importance,
      }));
      await Chunk.insertMany(chunksToInsert);
    }
  },

  /**
   * Delete a version (only non-baseline versions).
   */
  // Delete a non-baseline version by ID
  async deleteVersion(
    courseId: string,
    versionId: string
  ): Promise<boolean> {
    const result = await Version.deleteOne({
      _id: versionId,
      courseId,
      isBaseline: false,
    });
    return result.deletedCount > 0;
  },
};
