import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SessionManager } from './session-manager.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createWebServer(sessionManager: SessionManager) {
  const app = express();

  app.use(express.json());
  app.use(express.static(join(__dirname, 'public')));

  // Create a new session (optionally with phone number for pairing code flow)
  app.post('/api/session', (req, res) => {
    try {
      const phoneNumber = req.body?.phoneNumber || undefined;
      const { sessionId } = sessionManager.createSession(phoneNumber);
      res.json({ sessionId });
    } catch (err: any) {
      res.status(503).json({ error: err.message });
    }
  });

  // Per-session status + QR
  app.get('/api/session/:id/status', (req, res) => {
    const botManager = sessionManager.getSession(req.params.id);
    if (!botManager) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({
      status: botManager.status,
      qr: botManager.lastQr,
      pairingCode: botManager.lastPairingCode,
      isPairingMode: botManager.isPairingMode,
    });
  });

  // Per-session SSE stream
  app.get('/api/session/:id/events', (req, res) => {
    const botManager = sessionManager.getSession(req.params.id);
    if (!botManager) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send current state immediately
    res.write(`data: ${JSON.stringify({ type: 'status', status: botManager.status })}\n\n`);
    if (botManager.isPairingMode) {
      res.write(`data: ${JSON.stringify({ type: 'mode', mode: 'pairing' })}\n\n`);
    }
    if (botManager.lastQr) {
      res.write(`data: ${JSON.stringify({ type: 'qr', qr: botManager.lastQr })}\n\n`);
    }
    if (botManager.lastPairingCode) {
      res.write(`data: ${JSON.stringify({ type: 'pairing_code', code: botManager.lastPairingCode })}\n\n`);
    }

    const onStatus = (status: string) => {
      res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
    };

    const onQr = (qr: string) => {
      res.write(`data: ${JSON.stringify({ type: 'qr', qr })}\n\n`);
    };

    const onPairingCode = (code: string) => {
      res.write(`data: ${JSON.stringify({ type: 'pairing_code', code })}\n\n`);
    };

    botManager.on('status', onStatus);
    botManager.on('qr', onQr);
    botManager.on('pairing_code', onPairingCode);

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    req.on('close', () => {
      botManager.off('status', onStatus);
      botManager.off('qr', onQr);
      botManager.off('pairing_code', onPairingCode);
      clearInterval(heartbeat);
    });
  });

  // SPA fallback — serve index.html for session routes
  app.get('/s/:id', (_req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
  });

  return app;
}

export function startWebServer(sessionManager: SessionManager): void {
  const app = createWebServer(sessionManager);
  app.listen(config.port, () => {
    logger.info({ port: config.port }, `Web server listening at http://localhost:${config.port}`);
  });
}
