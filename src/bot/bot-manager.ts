import { EventEmitter } from 'node:events';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, type WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrTerminal from 'qrcode-terminal';
import { initAuthState } from './baileys-auth.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export type BotStatus = 'stopped' | 'starting' | 'waiting_for_qr' | 'connected' | 'disconnected';

const INITIAL_RECONNECT_DELAY_MS = 5_000;   // Start at 5 seconds
const MAX_RECONNECT_DELAY_MS = 300_000;      // Cap at 5 minutes

export class BotManager extends EventEmitter {
  private socket: WASocket | null = null;
  private _status: BotStatus = 'stopped';
  private _lastQr: string | null = null;
  private _lastPairingCode: string | null = null;
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

    // Exponential backoff: 5s, 10s, 20s, 40s, 80s, 160s, 300s, 300s...
    const delayMs = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS,
    );

    logger.info({ attempt: this.reconnectAttempts, delaySec: (delayMs / 1000).toFixed(0) }, 'Scheduling reconnect...');
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.start();
      } catch (err) {
        logger.error({ err }, 'Reconnect failed');
      }
    }, delayMs);
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

    // Use pairing code (phone number) if BOT_PHONE_NUMBER is set, otherwise QR
    const usePairingCode = !!config.botPhoneNumber;

    this.socket = makeWASocket({
      auth: state,
      version,
      logger: baileysLogger as any,
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: !usePairingCode,
    });

    // Request pairing code if using phone number auth
    if (usePairingCode && !state.creds.registered) {
      // Small delay to let the socket initialize
      setTimeout(async () => {
        try {
          const phoneNumber = config.botPhoneNumber.replace(/[^0-9]/g, '');
          const code = await this.socket!.requestPairingCode(phoneNumber);
          logger.info({ code, phoneNumber }, '📱 PAIRING CODE — Enter this in WhatsApp > Linked Devices > Link with phone number');
          this._lastPairingCode = code;
          this.emit('pairing_code', code);
        } catch (err) {
          logger.error({ err }, 'Failed to request pairing code');
        }
      }, 3000);
    }

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

  /** Restart the bot with existing credentials. */
  async restart(): Promise<void> {
    logger.info('Restarting bot...');
    await this.stop();
    this.reconnectAttempts = 0;
    await this.start();
  }

  /** Nuclear option: delete auth credentials and restart. Forces a new QR scan. */
  async relink(): Promise<void> {
    logger.info('Relinking bot — clearing auth state...');
    await this.stop();
    this.reconnectAttempts = 0;
    const authDir = join(config.dataDir, 'baileys-auth');
    try {
      rmSync(authDir, { recursive: true, force: true });
      logger.info({ authDir }, 'Auth state deleted');
    } catch (err) {
      logger.error({ err }, 'Failed to delete auth state');
    }
    await this.start();
  }
}
