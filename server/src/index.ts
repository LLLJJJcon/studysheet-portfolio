import app from './app';
import { config } from './config';
import { connectDatabase } from './config/database';
import { Course } from './models/Course';
import { ContentTree } from './models/ContentTree';
import { Layout } from './models/Layout';
import { Chunk } from './models/Chunk';

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? (reason.stack || reason.message) : String(reason);
  console.error('[unhandledRejection] Caught (process kept alive):\n' + msg);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Caught (process kept alive):\n' + (err.stack || err.message));
});

const start = async () => {
  try {
    await connectDatabase();

    // Recover courses stuck in 'generating' from a previous crash/restart.
    // If tree + layout + chunks are all present we assume generation had
    // actually finished and only the status update was lost — bump to
    // 'editing' so the UI doesn't look un-generated. Otherwise fall back to
    // 'created' so the user can re-run.
    const stuckCourses = await Course.find({ status: 'generating' }, { _id: 1 }).lean();
    let recovered = 0;
    let reset = 0;
    for (const c of stuckCourses) {
      const [tree, layout, chunkCount] = await Promise.all([
        ContentTree.findOne({ courseId: c._id }).lean(),
        Layout.findOne({ courseId: c._id }).lean(),
        Chunk.countDocuments({ courseId: c._id }),
      ]);
      const complete = tree && layout && chunkCount > 0;
      await Course.updateOne(
        { _id: c._id },
        { $set: { status: complete ? 'editing' : 'created' } }
      );
      if (complete) recovered++; else reset++;
    }
    if (recovered > 0) console.log(`Recovered ${recovered} stuck course(s) to 'editing'`);
    if (reset > 0) console.log(`Reset ${reset} stuck course(s) to 'created'`);

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
