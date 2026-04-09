import app from './app';
import { config } from './config';
import { connectDatabase } from './config/database';

const start = async () => {
  try {
    await connectDatabase();

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
