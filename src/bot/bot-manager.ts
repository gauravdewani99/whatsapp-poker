import { EventEmitter } from 'node:events';
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, type WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrTerminal from 'qrcode-terminal';
import { initAuthState } from './baileys-auth.js';
import { logger } from '../utils/logger.js';

export type BotStatus = 'stopped' | 'starting' | 'waiting_for_qr' | 'connected' | 'disconnected';

const RECONNECT_DELAY_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class BotManager extends EventEmitter {
  private socket: WASocket | null = null;
  private _status: BotStatus = 'stopped';
  private _lastQr: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  get status(): BotStatus {
    return this._status;
  }

  get lastQr(): string | null {
    return this._lastQr;
  }

  private setStatus(status: BotStatus): void {
    this._status = status;
    this.emit('status', status);
    logger.debug({ status }, 'Bot status changed');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      logger.error({ attempts: this.reconnectAttempts }, 'Max reconnect attempts reached, giving up');
      this.setStatus('stopped');
      return;
    }
    logger.info({ attempt: this.reconnectAttempts }, `Scheduling reconnect in ${RECONNECT_DELAY_MS / 1000}s...`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.start();
      } catch (err) {
        logger.error({ err }, 'Reconnect failed');
      }
    }, RECONNECT_DELAY_MS);
  }

  /** Send a message to a group chat. Used by turn timer callbacks. */
  async sendGroupMessage(groupId: string, text: string): Promise<void> {
    if (!this.socket) return;
    try {
      await this.socket.sendMessage(groupId, { text });
    } catch (err) {
      logger.error({ err, groupId }, 'Failed to send group message');
    }
  }

  /** Get the underlying Baileys socket for message handler registration. */
  getSocket(): WASocket | null {
    return this.socket;
  }

  async start(): Promise<void> {
    if (this.socket) {
      logger.warn('Bot is already running or starting.');
      return;
    }

    this.setStatus('starting');
    this._lastQr = null;

    const { state, saveCreds } = await initAuthState();

    // Fetch the latest WA Web version for compatibility
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info({ version, isLatest }, 'Using WA Web version');

    // Suppress Baileys' internal logs in production
    const baileysLogger = logger.child({ module: 'baileys' });
    baileysLogger.level = 'silent';

    this.socket = makeWASocket({
      auth: state,
      version,
      logger: baileysLogger as any,
      browser: Browsers.macOS('Chrome'),
    });

    // Save credentials whenever they update (key rotation, etc.)
    this.socket.ev.on('creds.update', saveCreds);

    // Handle connection state changes
    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this._lastQr = qr;
        this.setStatus('waiting_for_qr');
        this.emit('qr', qr);

        // Print QR in terminal for initial setup
        logger.info('QR code generated. Scan with WhatsApp on the bot phone:');
        qrTerminal.generate(qr, { small: true });
      }

      if (connection === 'open') {
        this._lastQr = null;
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        logger.info('Bot connected to WhatsApp.');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.warn({ statusCode, shouldReconnect }, 'Connection closed');
        this.socket = null;
        this.setStatus('disconnected');

        if (shouldReconnect) {
          this.scheduleReconnect();
        } else {
          logger.error('Bot was logged out. Re-scan QR code to reconnect.');
          this.setStatus('stopped');
        }
      }
    });
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.socket) {
      this._lastQr = null;
      this.setStatus('stopped');
      return;
    }

    try {
      this.socket.end(undefined);
    } catch (err) {
      logger.error({ err }, 'Error ending socket');
    }

    this.socket = null;
    this._lastQr = null;
    this.setStatus('stopped');
  }
}
