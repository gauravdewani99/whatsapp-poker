import type { SeatPlayer } from '../models/player.js';
import type { TableState } from '../models/table.js';

export function getOccupiedSeats(table: TableState): SeatPlayer[] {
  return table.seats.filter((s): s is SeatPlayer => s !== null && !s.isSittingOut);
}

export function nextOccupiedSeat(table: TableState, fromSeat: number): number {
  const maxSeats = table.config.maxPlayers;
  let seat = (fromSeat + 1) % maxSeats;
  while (seat !== fromSeat) {
    const player = table.seats[seat];
    if (player && !player.isSittingOut) return seat;
    seat = (seat + 1) % maxSeats;
  }
  return fromSeat;
}

export function advanceDealer(table: TableState): void {
  table.dealerSeatIndex = nextOccupiedSeat(table, table.dealerSeatIndex);
}

export interface BlindPositions {
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  firstToActPreflop: number;
  firstToActPostflop: number;
}

export function getBlindPositions(table: TableState): BlindPositions {
  const activePlayers = getOccupiedSeats(table);
  const isHeadsUp = activePlayers.length === 2;

  const dealerSeat = table.dealerSeatIndex;

  if (isHeadsUp) {
    // Heads-up: dealer is SB, other player is BB
    const smallBlindSeat = dealerSeat;
    const bigBlindSeat = nextOccupiedSeat(table, dealerSeat);
    return {
      dealerSeat,
      smallBlindSeat,
      bigBlindSeat,
      firstToActPreflop: smallBlindSeat, // Dealer/SB acts first preflop
      firstToActPostflop: bigBlindSeat,  // BB acts first postflop
    };
  }

  // 3+ players: standard positions
  const smallBlindSeat = nextOccupiedSeat(table, dealerSeat);
  const bigBlindSeat = nextOccupiedSeat(table, smallBlindSeat);
  const firstToActPreflop = nextOccupiedSeat(table, bigBlindSeat);

  return {
    dealerSeat,
    smallBlindSeat,
    bigBlindSeat,
    firstToActPreflop,
    firstToActPostflop: smallBlindSeat, // Left of dealer acts first postflop
  };
}

export function postBlinds(table: TableState, positions: BlindPositions): void {
  const sbPlayer = table.seats[positions.smallBlindSeat];
  const bbPlayer = table.seats[positions.bigBlindSeat];

  if (!sbPlayer || !bbPlayer) {
    throw new Error('Blind players not found at expected seats');
  }

  const sbAmount = Math.min(table.config.smallBlind, sbPlayer.chipStack);
  sbPlayer.chipStack -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  if (sbPlayer.chipStack === 0) sbPlayer.isAllIn = true;

  const bbAmount = Math.min(table.config.bigBlind, bbPlayer.chipStack);
  bbPlayer.chipStack -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  if (bbPlayer.chipStack === 0) bbPlayer.isAllIn = true;
}
