import type { TableState } from '../models/table.js';
import type { SeatPlayer } from '../models/player.js';
import { getOccupiedSeats } from '../engine/blinds.js';

export function removebustedPlayers(table: TableState): SeatPlayer[] {
  const busted: SeatPlayer[] = [];
  for (let i = 0; i < table.seats.length; i++) {
    const seat = table.seats[i];
    if (seat && seat.chipStack === 0 && !seat.isAllIn) {
      busted.push(seat);
      table.seats[i] = null;
    }
  }
  return busted;
}

export function canStartNewHand(table: TableState): boolean {
  return getOccupiedSeats(table).length >= 2;
}

export function getSeatedPlayerCount(table: TableState): number {
  return table.seats.filter(s => s !== null).length;
}

export function findPlayerSeat(table: TableState, waId: string): SeatPlayer | null {
  return table.seats.find(s => s?.waId === waId) ?? null;
}
