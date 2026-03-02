import type { CardString } from './card.js';

export interface PlayerProfile {
  id: number;
  waId: string;
  displayName: string;
  chipBalance: number;
  totalBuyIn: number;
  totalCashOut: number;
  handsPlayed: number;
  handsWon: number;
}

export interface SeatPlayer {
  profileId: number;
  waId: string;
  displayName: string;
  seatIndex: number;
  chipStack: number;
  holeCards: [CardString, CardString] | null;
  isActive: boolean;
  isSittingOut: boolean;
  isAllIn: boolean;
  currentBet: number;
  hasActed: boolean;
  buyInAmount: number;
  /** Hands played in this session (incremented per hand) */
  sessionHandsPlayed: number;
  /** Hands won in this session (incremented per win) */
  sessionHandsWon: number;
}

export function createSeatPlayer(
  profile: PlayerProfile,
  seatIndex: number,
  buyIn: number,
): SeatPlayer {
  return {
    profileId: profile.id,
    waId: profile.waId,
    displayName: profile.displayName,
    seatIndex,
    chipStack: buyIn,
    holeCards: null,
    isActive: true,
    isSittingOut: false,
    isAllIn: false,
    currentBet: 0,
    hasActed: false,
    buyInAmount: buyIn,
    sessionHandsPlayed: 0,
    sessionHandsWon: 0,
  };
}
