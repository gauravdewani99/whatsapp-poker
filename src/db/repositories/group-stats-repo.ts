import { eq, and, sql } from 'drizzle-orm';
import type { DB } from '../connection.js';
import { groupPlayerStats } from '../schema.js';

export interface GroupPlayerStat {
  id: number;
  groupId: string;
  waId: string;
  displayName: string;
  sessionsPlayed: number;
  handsPlayed: number;
  handsWon: number;
  totalBuyIn: number;
  totalCashOut: number;
  biggestPot: number;
  lastPlayedAt: string | null;
}

export interface SessionEndPlayer {
  waId: string;
  displayName: string;
  buyIn: number;
  cashOut: number;
  handsPlayed: number;
  handsWon: number;
}

export class GroupStatsRepository {
  constructor(private db: DB) {}

  /** Get all stats for a group, sorted by net P&L descending. */
  getGroupStats(groupId: string): GroupPlayerStat[] {
    return this.db
      .select()
      .from(groupPlayerStats)
      .where(eq(groupPlayerStats.groupId, groupId))
      .all() as GroupPlayerStat[];
  }

  /** Record session-end stats for all players at a table. */
  recordSessionEnd(groupId: string, players: SessionEndPlayer[]): void {
    const now = new Date().toISOString();

    for (const p of players) {
      const existing = this.db
        .select()
        .from(groupPlayerStats)
        .where(
          and(
            eq(groupPlayerStats.groupId, groupId),
            eq(groupPlayerStats.waId, p.waId),
          ),
        )
        .get();

      if (existing) {
        this.db
          .update(groupPlayerStats)
          .set({
            displayName: p.displayName,
            sessionsPlayed: sql`${groupPlayerStats.sessionsPlayed} + 1`,
            handsPlayed: sql`${groupPlayerStats.handsPlayed} + ${p.handsPlayed}`,
            handsWon: sql`${groupPlayerStats.handsWon} + ${p.handsWon}`,
            totalBuyIn: sql`${groupPlayerStats.totalBuyIn} + ${p.buyIn}`,
            totalCashOut: sql`${groupPlayerStats.totalCashOut} + ${p.cashOut}`,
            lastPlayedAt: now,
          })
          .where(
            and(
              eq(groupPlayerStats.groupId, groupId),
              eq(groupPlayerStats.waId, p.waId),
            ),
          )
          .run();
      } else {
        this.db
          .insert(groupPlayerStats)
          .values({
            groupId,
            waId: p.waId,
            displayName: p.displayName,
            sessionsPlayed: 1,
            handsPlayed: p.handsPlayed,
            handsWon: p.handsWon,
            totalBuyIn: p.buyIn,
            totalCashOut: p.cashOut,
            biggestPot: 0,
            lastPlayedAt: now,
          })
          .run();
      }
    }
  }
}
