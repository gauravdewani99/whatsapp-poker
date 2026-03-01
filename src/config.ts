import 'dotenv/config';

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/poker.db',
  dataDir: process.env.DATA_DIR || './data',
  turnTimeoutSeconds: parseInt(process.env.TURN_TIMEOUT_SECONDS || '60', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  defaultStartingChips: parseInt(process.env.DEFAULT_STARTING_CHIPS || '10000', 10),
  port: parseInt(process.env.PORT || '3000', 10),
  maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3', 10),
  sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '3600000', 10),
} as const;
