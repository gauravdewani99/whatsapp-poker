import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { registerMessageHandler } from './message-handler.js';
import type { CommandRegistry } from './command-registry.js';
import type { GroupActivationManager } from '../state/group-activation.js';

export type BotStatus = 'stopped' | 'starting' | 'waiting_for_qr' | 'connected' | 'disconnected';

const RECONNECT_DELAY_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class BotManager extends EventEmitter {
  private client: InstanceType<typeof Client> | null = null;
  private _status: BotStatus = 'stopped';
  private _lastQr: string | null = null;
  private _lastPairingCode: string | null = null;
  private _phoneNumber: string | null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private registry: CommandRegistry;
  private activationManager: GroupActivationManager;
  private _lastActivity: number = Date.now();

  constructor(
    private sessionId: string,
    registry: CommandRegistry,
    activationManager: GroupActivationManager,
    phoneNumber?: string,
  ) {
    super();
    this.registry = registry;
    this.activationManager = activationManager;
    this._phoneNumber = phoneNumber ?? null;
  }

  get status(): BotStatus {
    return this._status;
  }

  get lastQr(): string | null {
    return this._lastQr;
  }

  get lastPairingCode(): string | null {
    return this._lastPairingCode;
  }

  get isPairingMode(): boolean {
    return this._phoneNumber !== null;
  }

  get lastActivity(): number {
    return this._lastActivity;
  }

  touch(): void {
    this._lastActivity = Date.now();
  }

  private setStatus(status: BotStatus): void {
    this._status = status;
    this.emit('status', status);
    logger.debug({ status, sessionId: this.sessionId }, 'Bot status changed');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      logger.error({ attempts: this.reconnectAttempts, sessionId: this.sessionId }, 'Max reconnect attempts reached, giving up');
      this.setStatus('stopped');
      return;
    }
    logger.info({ attempt: this.reconnectAttempts, sessionId: this.sessionId }, `Scheduling reconnect in ${RECONNECT_DELAY_MS / 1000}s...`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.start();
      } catch (err) {
        logger.error({ err, sessionId: this.sessionId }, 'Reconnect failed');
      }
    }, RECONNECT_DELAY_MS);
  }

  /** Send a message to a group chat. Used by turn timer callbacks. */
  async sendGroupMessage(groupId: string, text: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.sendMessage(groupId, text);
    } catch (err) {
      logger.error({ err, groupId, sessionId: this.sessionId }, 'Failed to send group message');
      // If the error is from a dead Puppeteer context, mark as disconnected
      // so we stop retrying and trigger reconnection
      const msg = err instanceof Error ? (err.message || '') + (err.stack || '') : String(err);
      if (msg.includes('ExecutionContext') || msg.includes('execution context') || msg.includes('Target closed') || msg.includes('Session closed')) {
        logger.warn({ sessionId: this.sessionId }, 'Detected dead browser context in sendGroupMessage, triggering disconnect');
        this.setStatus('disconnected');
        this.client = null;
        this.scheduleReconnect();
      }
    }
  }

  async start(): Promise<void> {
    if (this.client) {
      logger.warn({ sessionId: this.sessionId }, 'Bot is already running or starting.');
      return;
    }

    this.setStatus('starting');
    this._lastQr = null;

    const authPath = join(config.dataDir, 'sessions', this.sessionId, '.wwebjs_auth');

    const clientOptions: any = {
      authStrategy: new LocalAuth({ dataPath: authPath }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      },
    };

    if (this._phoneNumber) {
      clientOptions.pairWithPhoneNumber = {
        phoneNumber: this._phoneNumber,
        showNotification: true,
      };
    }

    this.client = new Client(clientOptions);

    this.client.on('qr', (qr: string) => {
      this._lastQr = qr;
      this.setStatus('waiting_for_qr');
      this.emit('qr', qr);
      logger.info({ sessionId: this.sessionId }, 'QR code generated. Waiting for scan...');
    });

    this.client.on('code', (code: string) => {
      this._lastPairingCode = code;
      this.setStatus('waiting_for_qr');
      this.emit('pairing_code', code);
      logger.info({ sessionId: this.sessionId }, 'Pairing code generated. Waiting for link...');
    });

    this.client.on('ready', () => {
      this._lastQr = null;
      this._lastPairingCode = null;
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      registerMessageHandler(this.client!, this.registry, this.activationManager);
      logger.info({ sessionId: this.sessionId }, 'Message handler registered.');
    });

    this.client.on('auth_failure', (msg: string) => {
      logger.error({ msg, sessionId: this.sessionId }, 'Authentication failed');
      this.setStatus('disconnected');
      this.client = null;
      this.scheduleReconnect();
    });

    this.client.on('disconnected', (reason: string) => {
      logger.warn({ reason, sessionId: this.sessionId }, 'Client disconnected');
      this.setStatus('disconnected');
      this.client = null;
      // Don't reconnect on LOGOUT — session is intentionally ending
      if (reason !== 'LOGOUT') {
        this.scheduleReconnect();
      }
    });

    try {
      await this.client.initialize();

      // Attach defensive error handlers to the underlying Puppeteer browser/page.
      // whatsapp-web.js internal operations (Client.inject, page.evaluate) can throw
      // after a disconnect/navigation race. Without these handlers, the errors become
      // uncaught exceptions that crash the entire Node process.
      const pupPage = (this.client as any).pupPage;
      const pupBrowser = (this.client as any).pupBrowser;

      if (pupPage) {
        pupPage.on('error', (err: Error) => {
          logger.error({ err, sessionId: this.sessionId }, 'Puppeteer page crashed');
        });
        pupPage.on('pageerror', (err: Error) => {
          logger.debug({ err: err.message, sessionId: this.sessionId }, 'Puppeteer page JS error');
        });
      }

      if (pupBrowser) {
        pupBrowser.on('disconnected', () => {
          logger.warn({ sessionId: this.sessionId }, 'Puppeteer browser disconnected');
          // If the client is still set, it means this was unexpected — clean up
          if (this.client) {
            this.setStatus('disconnected');
            this.client = null;
          }
        });
      }
    } catch (err) {
      logger.error({ err, sessionId: this.sessionId }, 'Failed to initialize WhatsApp client');
      this.client = null;
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.client) {
      this._lastQr = null;
      this.setStatus('stopped');
      return;
    }

    try {
      // Timeout destroy after 10s — Puppeteer can hang if the browser is already dead
      await Promise.race([
        this.client.destroy(),
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('destroy() timed out after 10s')), 10_000)
        ),
      ]);
    } catch (err) {
      logger.error({ err, sessionId: this.sessionId }, 'Error destroying client');
    }

    this.client = null;
    this._lastQr = null;
    this._lastPairingCode = null;
    this.setStatus('stopped');
  }
}
