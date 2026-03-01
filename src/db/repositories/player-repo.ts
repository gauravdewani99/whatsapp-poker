import { eq } from 'drizzle-orm';
import type { DB } from '../connection.js';
import { players } from '../schema.js';
import type { PlayerProfile } from '../../models/player.js';

export class PlayerRepository {
  constructor(private db: DB) {}

  findByWaId(waId: string): PlayerProfile | undefined {
    const rows = this.db.select().from(players).where(eq(players.waId, waId)).all();
    if (rows.length === 0) return undefined;
    const row = rows[0];
    return {
      id: row.id,
      waId: row.waId,
      displayName: row.displayName,
      chipBalance: row.chipBalance,
      totalBuyIn: row.totalBuyIn,
      totalCashOut: row.totalCashOut,
      handsPlayed: row.handsPlayed,
      handsWon: row.handsWon,
    };
  }

  findOrCreate(waId: string, displayName: string, startingChips: number = 0): PlayerProfile {
    const existing = this.findByWaId(waId);
    if (existing) return existing;

    const result = this.db.insert(players).values({
      waId,
      displayName,
      chipBalance: startingChips,
    }).returning().all();

    const row = result[0];
    return {
      id: row.id,
      waId: row.waId,
      displayName: row.displayName,
      chipBalance: row.chipBalance,
      totalBuyIn: row.totalBuyIn,
      totalCashOut: row.totalCashOut,
      handsPlayed: row.handsPlayed,
      handsWon: row.handsWon,
    };
  }

  updateBalance(playerId: number, newBalance: number): void {
    this.db.update(players)
      .set({ chipBalance: newBalance, updatedAt: new Date().toISOString() })
      .where(eq(players.id, playerId))
      .run();
  }

  addBuyIn(playerId: number, amount: number): void {
    const player = this.db.select().from(players).where(eq(players.id, playerId)).all()[0];
    if (!player) return;
    this.db.update(players)
      .set({
        chipBalance: player.chipBalance + amount,
        totalBuyIn: player.totalBuyIn + amount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(players.id, playerId))
      .run();
  }

  recordHandPlayed(playerId: number, won: boolean): void {
    const player = this.db.select().from(players).where(eq(players.id, playerId)).all()[0];
    if (!player) return;
    this.db.update(players)
      .set({
        handsPlayed: player.handsPlayed + 1,
        handsWon: won ? player.handsWon + 1 : player.handsWon,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(players.id, playerId))
      .run();
  }
}
