import type { DB } from '../connection.js';
import { actions } from '../schema.js';

export class ActionRepository {
  constructor(private db: DB) {}

  recordAction(
    handId: number,
    playerId: number,
    phase: 'preflop' | 'flop' | 'turn' | 'river',
    actionType: 'fold' | 'check' | 'call' | 'raise' | 'all_in' | 'post_sb' | 'post_bb',
    amount: number,
    potAfter: number,
    sequence: number,
  ): void {
    this.db.insert(actions).values({
      handId,
      playerId,
      phase,
      actionType,
      amount,
      potAfter,
      sequence,
    }).run();
  }
}
