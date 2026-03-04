import { logger } from '../utils/logger.js';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export class IdleTimer {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  resetTimer(groupId: string, onIdle: () => void): void {
    this.clearTimer(groupId);
    const timer = setTimeout(() => {
      this.timers.delete(groupId);
      onIdle();
    }, IDLE_TIMEOUT_MS);
    this.timers.set(groupId, timer);
    logger.debug({ groupId }, 'Idle timer reset (10 min)');
  }

  clearTimer(groupId: string): void {
    const timer = this.timers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(groupId);
    }
  }

  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
