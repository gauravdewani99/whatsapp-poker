import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { BotManager } from '../bot/bot-manager.js';
import { CommandRegistry } from '../bot/command-registry.js';
import { registerAllCommands } from '../bot/commands/index.js';
import { TableManager } from '../state/table-manager.js';
import { GroupActivationManager } from '../state/group-activation.js';
import { TurnTimer } from '../state/turn-timer.js';
import type { DB } from '../db/connection.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const QR_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes — kill sessions that were never scanned

interface SessionState {
  botManager: BotManager;
  registry: CommandRegistry;
  tableManager: TableManager;
  activationManager: GroupActivationManager;
  createdAt: number;
}

export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private db: DB) {}

  createSession(phoneNumber?: string): { sessionId: string; botManager: BotManager } {
    if (this.sessions.size >= config.maxConcurrentSessions) {
      throw new Error('Server at capacity. Please try again later.');
    }

    const sessionId = randomUUID();

    // Each session gets its own isolated game state
    const tableManager = new TableManager();
    const activationManager = new GroupActivationManager(this.db);
    const registry = new CommandRegistry(tableManager, this.db);
    registerAllCommands(registry, activationManager);

    // Wire turn timer and bot manager into registry
    const turnTimer = new TurnTimer();
    registry.setTurnTimer(turnTimer);

    const botManager = new BotManager(sessionId, registry, activationManager, phoneNumber);
    registry.setBotManager(botManager);

    // Clear all turn timers when bot disconnects or stops — prevents
    // timer callbacks from repeatedly calling sendGroupMessage() on a dead context
    botManager.on('status', (status: string) => {
      if (status === 'disconnected' || status === 'stopped') {
        turnTimer.clearAll();
        logger.info({ sessionId, status }, 'Cleared all turn timers due to bot status change');
      }
    });

    this.sessions.set(sessionId, {
      botManager,
      registry,
      tableManager,
      activationManager,
      createdAt: Date.now(),
    });

    // Fire-and-forget — QR events will flow to SSE clients
    botManager.start().catch(err => {
      logger.error({ sessionId, err }, 'Failed to start session');
    });

    logger.info({ sessionId, activeSessions: this.sessions.size }, 'Session created');
    return { sessionId, botManager };
  }

  getSession(sessionId: string): BotManager | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.botManager.touch();
    return session.botManager;
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear turn timers first to stop any pending callbacks
    const turnTimer = session.registry.getTurnTimer();
    if (turnTimer) turnTimer.clearAll();

    await session.botManager.stop();
    this.sessions.delete(sessionId);

    // Clean up session files on disk
    try {
      rmSync(join(config.dataDir, 'sessions', sessionId), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    logger.info({ sessionId, activeSessions: this.sessions.size }, 'Session destroyed');
  }

  startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions) {
        const status = session.botManager.status;
        const age = now - session.createdAt;

        // Kill sessions stuck in waiting_for_qr — nobody scanned within 3 minutes
        if (
          (status === 'waiting_for_qr' || status === 'starting') &&
          age > QR_TIMEOUT_MS
        ) {
          logger.info({ sessionId, status, ageMs: age }, 'Unscanned session timed out, cleaning up');
          this.destroySession(sessionId).catch(err => {
            logger.error({ sessionId, err }, 'Error destroying unscanned session');
          });
          continue;
        }

        // Kill connected sessions that have been idle too long
        if (now - session.botManager.lastActivity > config.sessionTimeoutMs) {
          logger.info({ sessionId }, 'Session expired (idle), cleaning up');
          this.destroySession(sessionId).catch(err => {
            logger.error({ sessionId, err }, 'Error destroying expired session');
          });
        }
      }
      logger.debug({ activeSessions: this.sessions.size }, 'Session cleanup sweep');
    }, CLEANUP_INTERVAL_MS);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async destroyAll(): Promise<void> {
    this.stopCleanup();
    const promises = [...this.sessions.keys()].map(id => this.destroySession(id));
    await Promise.allSettled(promises);
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}
