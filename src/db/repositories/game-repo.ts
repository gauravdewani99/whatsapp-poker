import { eq, desc } from 'drizzle-orm';
import type { DB } from '../connection.js';
import { games, hands, handPlayers } from '../schema.js';

export class GameRepository {
  constructor(private db: DB) {}

  async createGame(groupId: string, smallBlind: number, bigBlind: number, minBuyIn: number, maxBuyIn: number, createdBy: number): Promise<number> {
    const result = await this.db.insert(games).values({
      groupId,
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      createdBy,
      status: 'waiting',
    }).returning();
    return result[0].id;
  }

  async startGame(gameId: number): Promise<void> {
    await this.db.update(games)
      .set({ status: 'active', startedAt: new Date().toISOString() })
      .where(eq(games.id, gameId));
  }

  async endGame(gameId: number): Promise<void> {
    await this.db.update(games)
      .set({ status: 'finished', endedAt: new Date().toISOString() })
      .where(eq(games.id, gameId));
  }

  async recordHand(
    gameId: number,
    handNumber: number,
    dealerSeat: number,
    communityCards: string[],
    potTotal: number,
    winners: Array<{ playerId: number; amount: number; hand: string }>,
  ): Promise<number> {
    const result = await this.db.insert(hands).values({
      gameId,
      handNumber,
      dealerSeat,
      communityCards: JSON.stringify(communityCards),
      potTotal,
      winnersJson: JSON.stringify(winners),
      endedAt: new Date().toISOString(),
    }).returning();
    return result[0].id;
  }

  async recordHandPlayer(
    handId: number,
    playerId: number,
    seatPosition: number,
    holeCards: string[] | null,
    chipsBefore: number,
    chipsAfter: number,
    finalAction: 'fold' | 'showdown' | 'win_uncontested',
  ): Promise<void> {
    await this.db.insert(handPlayers).values({
      handId,
      playerId,
      seatPosition,
      holeCards: holeCards ? JSON.stringify(holeCards) : null,
      chipsBefore,
      chipsAfter,
      finalAction,
    });
  }

  async getRecentHands(gameId: number, limit: number = 5): Promise<Array<{
    handNumber: number;
    winner: string;
    amount: number;
    hand: string;
  }>> {
    const rows = await this.db.select()
      .from(hands)
      .where(eq(hands.gameId, gameId))
      .orderBy(desc(hands.handNumber))
      .limit(limit);

    return rows.map(row => {
      const winners = JSON.parse(row.winnersJson || '[]') as Array<{ playerId: number; displayName?: string; amount: number; hand: string }>;
      const first = winners[0];
      return {
        handNumber: row.handNumber,
        winner: first?.displayName || first?.playerId?.toString() || 'Unknown',
        amount: first?.amount || row.potTotal,
        hand: first?.hand || '',
      };
    });
  }
}
