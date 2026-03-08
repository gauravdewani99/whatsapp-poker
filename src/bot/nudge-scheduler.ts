import type { BotManager } from './bot-manager.js';
import type { GroupActivationManager } from '../state/group-activation.js';
import type { TableManager } from '../state/table-manager.js';
import type { DB } from '../db/connection.js';
import { GroupStatsRepository } from '../db/repositories/group-stats-repo.js';
import { formatChips } from '../messages/formatter.js';
import { logger } from '../utils/logger.js';

// ─── IST evening window (6pm–10pm IST = 12:30–16:30 UTC) ───────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
const WINDOW_START_HOUR = 18; // 6pm IST
const WINDOW_END_HOUR = 22;   // 10pm IST

// ─── Personalized message templates (need ≥2 players) ───────────────────
type PlayerInfo = { name: string; pnl: number };

const PERSONALIZED_TEMPLATES: Array<(p1: PlayerInfo, p2: PlayerInfo) => string> = [
  (p1, p2) =>
    `\uD83C\uDCCF *${p1.name}*, how you feeling for a quick session? *${p2.name}* has been talking a big game. Time to shut them up \u2014 \`!poker start\``,
  (p1, p2) =>
    `\u2660\uFE0F *${p1.name}*, The House hasn't seen you at the table in a while. *${p2.name}* is getting too comfortable. Don't let that slide.`,
  (p1, p2) => {
    const sign = p1.pnl >= 0 ? '+' : '';
    return `\uD83D\uDCB0 *${p1.name}*, you're sitting at ${sign}${formatChips(p1.pnl)} all-time. *${p2.name}* is right behind you. One session could change everything \u2014 \`!poker start\``;
  },
  (p1, p2) =>
    `\uD83D\uDD25 *${p1.name}* vs *${p2.name}* \u2014 last session was close. The House thinks a rematch is overdue. \`!poker start\``,
  (p1, p2) =>
    `\uD83C\uDFAF *${p1.name}*, the chips miss you. *${p2.name}* has been cleaning up. Someone needs to bring the competition.`,
];

// ─── Fallback messages (for groups with 0–1 players in history) ─────────
const FALLBACK_MESSAGES = [
  "\uD83C\uDCCF The cards aren't going to deal themselves. Who's in? `!poker start`",
  "\u2660\uFE0F The House is open. The felt is warm. All that's missing is your bad decisions \u2014 `!poker start`",
];

/** Calculate ms until a random time in the next 6pm–10pm IST window. */
function msUntilNextWindow(): number {
  const now = Date.now();
  // Current time in IST (as a Date where UTC methods give IST values)
  const istNow = new Date(now + IST_OFFSET_MS);

  // Random target: hour in [18,22), minute in [0,60)
  const targetHour = WINDOW_START_HOUR + Math.floor(Math.random() * (WINDOW_END_HOUR - WINDOW_START_HOUR));
  const targetMinute = Math.floor(Math.random() * 60);

  // Build target in IST
  const target = new Date(istNow);
  target.setUTCHours(targetHour, targetMinute, 0, 0);

  // If target already passed today in IST, schedule for tomorrow
  if (target.getTime() <= istNow.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  // Convert IST target back to real UTC
  const targetUTC = target.getTime() - IST_OFFSET_MS;
  return targetUTC - now;
}

export class NudgeScheduler {
  private timerId: NodeJS.Timeout | null = null;
  private lastTemplateIndex: Map<string, number> = new Map();
  private groupStatsRepo: GroupStatsRepository;

  constructor(
    private botManager: BotManager,
    private activationManager: GroupActivationManager,
    private db: DB,
    private tableManager: TableManager,
  ) {
    this.groupStatsRepo = new GroupStatsRepository(db);
  }

  start(): void {
    if (this.timerId) return;
    this.scheduleNext();
  }

  stop(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
      logger.info('Nudge scheduler stopped');
    }
  }

  private scheduleNext(): void {
    const delayMs = msUntilNextWindow();
    const delayHours = (delayMs / (60 * 60 * 1000)).toFixed(1);
    const targetTime = new Date(Date.now() + delayMs).toISOString();

    logger.info({ delayHours, targetTime }, 'Next nudge scheduled');

    this.timerId = setTimeout(async () => {
      await this.sendNudges();
      this.scheduleNext(); // schedule tomorrow's nudge
    }, delayMs);
  }

  private async sendNudges(): Promise<void> {
    const groupIds = this.activationManager.getActiveGroupIds();
    if (groupIds.length === 0) return;

    logger.info({ groupCount: groupIds.length }, 'Sending nudge messages');

    for (const groupId of groupIds) {
      try {
        // Skip nudge if a table is active in this group
        if (this.tableManager.hasTable(groupId)) {
          logger.debug({ groupId }, 'Skipping nudge — table is active');
          continue;
        }

        const message = await this.generateMessage(groupId);
        await this.botManager.sendGroupMessage(groupId, message);
        // Small delay between groups to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        logger.error({ err, groupId }, 'Failed to send nudge message');
      }
    }
  }

  private async generateMessage(groupId: string): Promise<string> {
    const stats = await this.groupStatsRepo.getGroupStats(groupId);

    // Need at least 2 players for personalized messages
    if (stats.length < 2) {
      return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
    }

    // Pick 2 random distinct players
    const shuffled = [...stats].sort(() => Math.random() - 0.5);
    const p1: PlayerInfo = {
      name: shuffled[0].displayName,
      pnl: shuffled[0].totalCashOut - shuffled[0].totalBuyIn,
    };
    const p2: PlayerInfo = {
      name: shuffled[1].displayName,
      pnl: shuffled[1].totalCashOut - shuffled[1].totalBuyIn,
    };

    // Pick a template, avoid repeating the last one for this group
    const lastIdx = this.lastTemplateIndex.get(groupId) ?? -1;
    let idx: number;
    do {
      idx = Math.floor(Math.random() * PERSONALIZED_TEMPLATES.length);
    } while (idx === lastIdx && PERSONALIZED_TEMPLATES.length > 1);

    this.lastTemplateIndex.set(groupId, idx);
    return PERSONALIZED_TEMPLATES[idx](p1, p2);
  }
}
