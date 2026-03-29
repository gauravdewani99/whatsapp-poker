import 'dotenv/config';
import { BotManager } from './bot/bot-manager.js';
import { CommandRegistry } from './bot/command-registry.js';
import { registerAllCommands } from './bot/commands/index.js';
import { registerMessageHandler } from './bot/message-handler.js';
import { registerWelcomeHandler } from './bot/welcome-handler.js';
import { TableManager } from './state/table-manager.js';
import { GroupActivationManager } from './state/group-activation.js';
import { TurnTimer } from './state/turn-timer.js';
import { NudgeScheduler } from './bot/nudge-scheduler.js';
import { KickVoteManager } from './state/kick-vote-manager.js';
import { RimManager } from './state/rim-manager.js';
import { IdleTimer } from './state/idle-timer.js';
import { initDatabase } from './db/connection.js';
import { startWebServer } from './web/server.js';
import { logger } from './utils/logger.js';

// ─── Process-level safety net ───────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — keeping process alive');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection — keeping process alive');
});

async function main() {
  logger.info('Starting The House...');

  // 1. Initialize shared database
  const db = initDatabase();
  logger.info('Database connected.');

  // 2. Create single shared game state
  const tableManager = new TableManager();
  const activationManager = new GroupActivationManager(db);
  await activationManager.init();
  const registry = new CommandRegistry(tableManager, db);
  registerAllCommands(registry);

  // 3. Wire turn timer and idle timer
  const turnTimer = new TurnTimer();
  registry.setTurnTimer(turnTimer);
  const idleTimer = new IdleTimer();
  registry.setIdleTimer(idleTimer);

  // 4. Create single bot manager (Baileys)
  const botManager = new BotManager();
  registry.setBotManager(botManager);

  // 5. Create kick vote manager, RIM manager & nudge scheduler
  const kickVoteManager = new KickVoteManager(botManager);
  registry.setKickVoteManager(kickVoteManager);
  const rimManager = new RimManager(botManager);
  registry.setRimManager(rimManager);
  const nudgeScheduler = new NudgeScheduler(botManager, activationManager, db, tableManager);

  // Clear turn timers when bot disconnects
  botManager.on('status', (status: string) => {
    if (status === 'disconnected' || status === 'stopped') {
      turnTimer.clearAll();
      idleTimer.clearAll();
      kickVoteManager.clearAll();
      rimManager.clearAll();
      nudgeScheduler.stop();
      logger.info({ status }, 'Cleared all timers and nudge scheduler due to bot status change');
    }
  });

  // 6. Start the bot (connects to WhatsApp via Baileys)
  await botManager.start();

  // 7. Register message handler + welcome handler once socket is available
  botManager.on('status', (status: string) => {
    if (status === 'connected') {
      const socket = botManager.getSocket();
      if (socket) {
        registerMessageHandler(socket, registry, activationManager);
        registerWelcomeHandler(socket, activationManager);
        nudgeScheduler.start().catch(err => logger.error({ err }, 'Failed to start nudge scheduler'));
        logger.info('Message handler, welcome handler, and nudge scheduler registered.');
      }
    }
  });

  // 8. Start web server (landing page + bot status)
  startWebServer(botManager);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    turnTimer.clearAll();
    idleTimer.clearAll();
    kickVoteManager.clearAll();
    rimManager.clearAll();
    nudgeScheduler.stop();
    await botManager.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
