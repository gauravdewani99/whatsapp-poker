import 'dotenv/config';
import { SessionManager } from './web/session-manager.js';
import { initDatabase } from './db/connection.js';
import { startWebServer } from './web/server.js';
import { logger } from './utils/logger.js';

// ─── Process-level safety net ───────────────────────────────────────────
// Puppeteer/whatsapp-web.js can throw unhandled exceptions from internal
// operations (e.g. execution context destroyed during navigation). Without
// these handlers, one bad session crashes the entire process and kills all
// other active sessions.
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — keeping process alive');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection — keeping process alive');
});

function main() {
  logger.info('Starting WhatsApp Poker Bot...');

  // 1. Initialize shared database
  const db = initDatabase();
  logger.info('Database connected.');

  // 2. Create session manager (each session gets its own isolated game state)
  const sessionManager = new SessionManager(db);
  sessionManager.startCleanup();
  logger.info('Session manager ready.');

  // 3. Start web server
  startWebServer(sessionManager);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await sessionManager.destroyAll();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
