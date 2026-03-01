import { eq, desc } from 'drizzle-orm';
import type { DB } from '../connection.js';
import { games, hands, handPlayers } from '../schema.js';

export class GameRepository {
  constructor(private db: DB) {}

  createGame(groupId: string, smallBlind: number, bigBlind: number, minBuyIn: number, maxBuyIn: number, createdBy: number): number {
    const result = this.db.insert(games).values({
      groupId,
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      createdBy,
      status: 'waiting',
    }).returning().all();
    return result[0].id;
  }

  startGame(gameId: number): void {
    this.db.update(games)
      .set({ status: 'active', startedAt: new Date().toISOString() })
      .where(eq(games.id, gameId))
      .run();
  }

  endGame(gameId: number): void {
    this.db.update(games)
      .set({ status: 'finished', endedAt: new Date().toISOString() })
      .where(eq(games.id, gameId))
      .run();
  }

  recordHand(
    gameId: number,
    handNumber: number,
    dealerSeat: number,
    communityCards: string[],
    potTotal: number,
    winners: Array<{ playerId: number; amount: number; hand: string }>,
  ): number {
    const result = this.db.insert(hands).values({
      gameId,
      handNumber,
      dealerSeat,
      communityCards: JSON.stringify(communityCards),
      potTotal,
      winnersJson: JSON.stringify(winners),
      endedAt: new Date().toISOString(),
    }).returning().all();
    return result[0].id;
  }

  recordHandPlayer(
    handId: number,
    playerId: number,
    seatPosition: number,
    holeCards: string[] | null,
    chipsBefore: number,
    chipsAfter: number,
    finalAction: 'fold' | 'showdown' | 'win_uncontested',
  ): void {
    this.db.insert(handPlayers).values({
      handId,
      playerId,
      seatPosition,
      holeCards: holeCards ? JSON.stringify(holeCards) : null,
      chipsBefore,
      chipsAfter,
      finalAction,
    }).run();
  }

  getRecentHands(gameId: number, limit: number = 5): Array<{
    handNumber: number;
    winner: string;
    amount: number;
    hand: string;
  }> {
    const rows = this.db.select()
      .from(hands)
      .where(eq(hands.gameId, gameId))
      .orderBy(desc(hands.handNumber))
      .limit(limit)
      .all();

    return rows.map(row => {
      const winners = JSON.parse(row.winnersJson || '[]') as Array<{ playerId: number; amount: number; hand: string }>;
      const first = winners[0];
      return {
        handNumber: row.handNumber,
        winner: first?.playerId?.toString() || 'Unknown',
        amount: first?.amount || row.potTotal,
        hand: first?.hand || '',
      };
    });
  }
}
