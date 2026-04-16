import app from './app';
import { config } from './config';
import { connectDatabase } from './config/database';
import { Course } from './models/Course';

const start = async () => {
  try {
    await connectDatabase();

    // Reset any courses stuck in 'generating' from a previous crash/restart
    const stuckResult = await Course.updateMany(
      { status: 'generating' },
      { $set: { status: 'created' } }
    );
    if (stuckResult.modifiedCount > 0) {
      console.log(`Reset ${stuckResult.modifiedCount} stuck course(s) from 'generating' to 'created'`);
    }

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
