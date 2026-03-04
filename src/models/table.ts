import type { GameConfig, GamePhase, BettingActionEvent } from './game.js';
import type { SeatPlayer } from './player.js';
import type { CardString } from './card.js';
import type { PotState } from './pot.js';

export interface LeftPlayer {
  displayName: string;
  waId: string;
  buyInAmount: number;
  cashOut: number;
}

export interface TableState {
  gameId: number;
  config: GameConfig;
  phase: GamePhase;
  handNumber: number;

  seats: (SeatPlayer | null)[];
  dealerSeatIndex: number;
  creatorWaId: string;

  deck: CardString[];
  communityCards: CardString[];
  potState: PotState;

  currentPlayerSeatIndex: number;
  lastRaiseSeatIndex: number;
  currentMinRaise: number;
  actionHistory: BettingActionEvent[];

  /** Players who left mid-session via !poker leave */
  leftPlayers: LeftPlayer[];
}
