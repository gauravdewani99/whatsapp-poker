import { eq } from 'drizzle-orm';
import type { DB } from '../connection.js';
import { players } from '../schema.js';
import type { PlayerProfile } from '../../models/player.js';

export class PlayerRepository {
  constructor(private db: DB) {}

  async findByWaId(waId: string): Promise<PlayerProfile | undefined> {
    const rows = await this.db.select().from(players).where(eq(players.waId, waId));
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

  async findOrCreate(waId: string, displayName: string, startingChips: number = 0): Promise<PlayerProfile> {
    const existing = await this.findByWaId(waId);
    if (existing) return existing;

    const result = await this.db.insert(players).values({
      waId,
      displayName,
      chipBalance: startingChips,
    }).returning();

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

  async updateBalance(playerId: number, newBalance: number): Promise<void> {
    await this.db.update(players)
      .set({ chipBalance: newBalance, updatedAt: new Date().toISOString() })
      .where(eq(players.id, playerId));
  }

  async addBuyIn(playerId: number, amount: number): Promise<void> {
    const rows = await this.db.select().from(players).where(eq(players.id, playerId));
    const player = rows[0];
    if (!player) return;
    await this.db.update(players)
      .set({
        chipBalance: player.chipBalance + amount,
        totalBuyIn: player.totalBuyIn + amount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(players.id, playerId));
  }

  async recordHandPlayed(playerId: number, won: boolean): Promise<void> {
    const rows = await this.db.select().from(players).where(eq(players.id, playerId));
    const player = rows[0];
    if (!player) return;
    await this.db.update(players)
      .set({
        handsPlayed: player.handsPlayed + 1,
        handsWon: won ? player.handsWon + 1 : player.handsWon,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(players.id, playerId));
  }
}
