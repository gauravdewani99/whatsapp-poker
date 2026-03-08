import type { DB } from '../connection.js';
import { actions } from '../schema.js';

export class ActionRepository {
  constructor(private db: DB) {}

  async recordAction(
    handId: number,
    playerId: number,
    phase: 'preflop' | 'flop' | 'turn' | 'river',
    actionType: 'fold' | 'check' | 'call' | 'raise' | 'all_in' | 'post_sb' | 'post_bb',
    amount: number,
    potAfter: number,
    sequence: number,
  ): Promise<void> {
    await this.db.insert(actions).values({
      handId,
      playerId,
      phase,
      actionType,
      amount,
      potAfter,
      sequence,
    });
  }
}
