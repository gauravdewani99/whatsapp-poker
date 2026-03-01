import type { Pot, PotState } from '../models/pot.js';
import type { SeatPlayer } from '../models/player.js';

export class PotManager {
  private pots: Pot[] = [];

  get state(): PotState {
    const totalAmount = this.pots.reduce((sum, p) => sum + p.amount, 0);
    return { pots: this.pots.map(p => ({ ...p, eligiblePlayerIds: [...p.eligiblePlayerIds] })), totalAmount };
  }

  collectBets(players: SeatPlayer[]): void {
    const bettors = players
      .filter(p => p.currentBet > 0)
      .map(p => ({
        id: p.profileId,
        bet: p.currentBet,
        isEligible: p.isActive || p.isAllIn,
      }))
      .sort((a, b) => a.bet - b.bet);

    if (bettors.length === 0) return;

    let previousLevel = 0;
    const uniqueLevels = [...new Set(bettors.map(b => b.bet))];

    for (const level of uniqueLevels) {
      const slicePerPlayer = level - previousLevel;
      const contributors = bettors.filter(b => b.bet >= level);
      const potAmount = slicePerPlayer * contributors.length;

      const eligibleIds = contributors
        .filter(b => b.isEligible)
        .map(b => b.id);

      const lastPot = this.pots[this.pots.length - 1];
      if (lastPot && this.sameEligibility(lastPot.eligiblePlayerIds, eligibleIds)) {
        lastPot.amount += potAmount;
      } else if (potAmount > 0) {
        this.pots.push({ amount: potAmount, eligiblePlayerIds: eligibleIds });
      }

      previousLevel = level;
    }
  }

  private sameEligibility(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every(id => setA.has(id));
  }

  reset(): void {
    this.pots = [];
  }

  get totalAmount(): number {
    return this.pots.reduce((sum, p) => sum + p.amount, 0);
  }
}
