import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { BotManager } from '../bot/bot-manager.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createWebServer(botManager: BotManager) {
  const app = express();

  app.use(express.json());
  app.use(express.static(join(__dirname, 'public')));

  // Bot status endpoint
  app.get('/api/status', (_req, res) => {
    res.json({
      status: botManager.status,
      phoneNumber: config.botPhoneNumber || null,
    });
  });

  // SSE stream for real-time bot status (used during initial QR setup)
  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({ type: 'status', status: botManager.status })}\n\n`);

    if (botManager.lastQr) {
      res.write(`data: ${JSON.stringify({ type: 'qr', qr: botManager.lastQr })}\n\n`);
    }

    const onStatus = (status: string) => {
      res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`);
    };

    const onQr = (qr: string) => {
      res.write(`data: ${JSON.stringify({ type: 'qr', qr })}\n\n`);
    };

    botManager.on('status', onStatus);
    botManager.on('qr', onQr);

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    req.on('close', () => {
      botManager.off('status', onStatus);
      botManager.off('qr', onQr);
      clearInterval(heartbeat);
    });
  });

  // ─── Admin routes (protected by ADMIN_KEY) ───────────────────────────

  const checkAdminKey = (req: express.Request, res: express.Response): boolean => {
    if (req.query.key !== config.adminKey) {
      res.status(403).json({ error: 'Forbidden' });
      return false;
    }
    return true;
  };

  app.get('/admin', (req, res) => {
    if (!checkAdminKey(req, res)) return;
    res.sendFile(join(__dirname, 'public', 'admin.html'));
  });

  app.post('/api/restart', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    logger.info('Admin triggered restart');
    res.json({ success: true });
    await botManager.restart();
  });

  app.post('/api/relink', async (req, res) => {
    if (!checkAdminKey(req, res)) return;
    logger.info('Admin triggered relink');
    res.json({ success: true });
    await botManager.relink();
  });

  return app;
}

export function startWebServer(botManager: BotManager): void {
  const app = createWebServer(botManager);
  app.listen(config.port, () => {
    logger.info({ port: config.port }, `Web server listening at http://localhost:${config.port}`);
  });
}
