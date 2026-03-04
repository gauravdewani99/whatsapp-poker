import type { TableState } from '../models/table.js';
import type { GameConfig } from '../models/game.js';
import { emptyPotState } from '../models/pot.js';
import { GameRound } from '../engine/game-round.js';

export class TableManager {
  private tables: Map<string, TableState> = new Map();
  private gameRounds: Map<string, GameRound> = new Map();

  getTable(groupId: string): TableState | undefined {
    return this.tables.get(groupId);
  }

  getGameRound(groupId: string): GameRound | undefined {
    return this.gameRounds.get(groupId);
  }

  createTable(groupId: string, config: GameConfig, gameId: number, creatorWaId: string): TableState {
    if (this.tables.has(groupId)) {
      throw new Error('A table is already active in this group.');
    }

    const table: TableState = {
      gameId,
      config,
      phase: 'waiting',
      handNumber: 0,
      seats: Array(config.maxPlayers).fill(null),
      dealerSeatIndex: 0,
      creatorWaId,
      deck: [],
      communityCards: [],
      potState: emptyPotState(),
      currentPlayerSeatIndex: -1,
      lastRaiseSeatIndex: -1,
      currentMinRaise: config.bigBlind,
      actionHistory: [],
      leftPlayers: [],
    };

    this.tables.set(groupId, table);
    const round = new GameRound(table);
    this.gameRounds.set(groupId, round);
    return table;
  }

  createNewRound(groupId: string): GameRound {
    const table = this.tables.get(groupId);
    if (!table) throw new Error('No table found for this group.');
    const round = new GameRound(table);
    this.gameRounds.set(groupId, round);
    return round;
  }

  removeTable(groupId: string): void {
    this.tables.delete(groupId);
    this.gameRounds.delete(groupId);
  }

  hasTable(groupId: string): boolean {
    return this.tables.has(groupId);
  }
}
