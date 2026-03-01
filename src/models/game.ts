export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type BettingAction = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

export interface BettingActionEvent {
  playerId: number;
  action: BettingAction;
  amount: number;
  timestamp: number;
}

export interface GameConfig {
  groupId: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  turnTimeoutSeconds: number;
  maxPlayers: number;
}

export function createDefaultConfig(
  groupId: string,
  smallBlind: number,
  bigBlind: number,
): GameConfig {
  return {
    groupId,
    smallBlind,
    bigBlind,
    minBuyIn: bigBlind * 40,
    maxBuyIn: bigBlind * 200,
    turnTimeoutSeconds: 60,
    maxPlayers: 9,
  };
}
