import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { config } from '../config.js';

const AUTH_DIR = join(config.dataDir, 'baileys-auth');

/**
 * Initializes Baileys multi-file auth state.
 * Creates the auth directory if it doesn't exist.
 * On first run, no credentials exist — Baileys will generate a QR code.
 * On subsequent runs, credentials are loaded from disk for auto-reconnect.
 */
export async function initAuthState() {
  mkdirSync(AUTH_DIR, { recursive: true });
  return useMultiFileAuthState(AUTH_DIR);
}
