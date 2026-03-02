import type { BotManager } from './bot-manager.js';
import type { GroupActivationManager } from '../state/group-activation.js';
import { logger } from '../utils/logger.js';

const NUDGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const JITTER_MS = 60 * 60 * 1000; // ±1 hour

const NUDGE_MESSAGES = [
  "\uD83C\uDCCF The cards aren't going to deal themselves. Who's in?",
  "\u2660\uFE0F A poker table without players is just sad furniture.",
  "\uD83D\uDCB0 Your chips are getting dusty. Time to put them to work.",
  "\uD83E\uDD14 Fun fact: 100% of hands you don't play, you don't win.",
  "\uD83C\uDFB0 The House is open and the felt is warm. !poker start to get going.",
  "\uD83D\uDE0F I've seen better bluffs from a mannequin. Prove me wrong \u2014 !poker start.",
  "\u2660\uFE0F\u2665\uFE0F\u2666\uFE0F\u2663\uFE0F The deck is shuffled and ready. Are you?",
  "\uD83C\uDFC6 Legends aren't made by folding. Get in here.",
  "\uD83D\uDD25 It's been too quiet. Time to raise some hell \u2014 and some bets.",
  "\uD83E\uDD37 No poker tonight? The House is judging you silently.",
];

export class NudgeScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private lastMessageIndex: Map<string, number> = new Map();

  constructor(
    private botManager: BotManager,
    private activationManager: GroupActivationManager,
  ) {}

  start(): void {
    if (this.intervalId) return;

    // Add random jitter to the first nudge
    const initialDelay = NUDGE_INTERVAL_MS + Math.floor((Math.random() - 0.5) * 2 * JITTER_MS);

    this.intervalId = setTimeout(() => {
      this.sendNudges();
      // Then set up recurring interval
      this.intervalId = setInterval(() => {
        this.sendNudges();
      }, NUDGE_INTERVAL_MS);
    }, initialDelay);

    logger.info({ initialDelayHours: (initialDelay / (60 * 60 * 1000)).toFixed(1) }, 'Nudge scheduler started');
  }

  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Nudge scheduler stopped');
    }
  }

  private async sendNudges(): Promise<void> {
    const groupIds = this.activationManager.getActiveGroupIds();
    if (groupIds.length === 0) return;

    logger.info({ groupCount: groupIds.length }, 'Sending nudge messages');

    for (const groupId of groupIds) {
      try {
        const message = this.pickMessage(groupId);
        await this.botManager.sendGroupMessage(groupId, message);
        // Small delay between groups to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        logger.error({ err, groupId }, 'Failed to send nudge message');
      }
    }
  }

  private pickMessage(groupId: string): string {
    const lastIdx = this.lastMessageIndex.get(groupId) ?? -1;
    let idx: number;

    do {
      idx = Math.floor(Math.random() * NUDGE_MESSAGES.length);
    } while (idx === lastIdx && NUDGE_MESSAGES.length > 1);

    this.lastMessageIndex.set(groupId, idx);
    return NUDGE_MESSAGES[idx];
  }
}
