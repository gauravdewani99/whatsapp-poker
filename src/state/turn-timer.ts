export type TimeoutCallback = () => Promise<void>;

export class TurnTimer {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private warnings: Map<string, NodeJS.Timeout> = new Map();

  startTimer(
    groupId: string,
    timeoutMs: number,
    onWarning: () => Promise<void>,
    onTimeout: TimeoutCallback,
  ): void {
    this.clearTimer(groupId);

    if (timeoutMs <= 0) return;

    // 15-second warning
    if (timeoutMs > 15_000) {
      const warningTimer = setTimeout(async () => {
        this.warnings.delete(groupId);
        await onWarning();
      }, timeoutMs - 15_000);
      this.warnings.set(groupId, warningTimer);
    }

    const timer = setTimeout(async () => {
      this.timers.delete(groupId);
      await onTimeout();
    }, timeoutMs);

    this.timers.set(groupId, timer);
  }

  clearTimer(groupId: string): void {
    const timer = this.timers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(groupId);
    }
    const warning = this.warnings.get(groupId);
    if (warning) {
      clearTimeout(warning);
      this.warnings.delete(groupId);
    }
  }

  clearAll(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const warning of this.warnings.values()) clearTimeout(warning);
    this.timers.clear();
    this.warnings.clear();
  }
}
