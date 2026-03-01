import type { SeatPlayer } from '../models/player.js';
import type { TableState } from '../models/table.js';
import type { BettingAction } from '../models/game.js';
import { nextOccupiedSeat } from './blinds.js';
import { InvalidActionError, NotYourTurnError } from '../utils/errors.js';

export function getActivePlayers(table: TableState): SeatPlayer[] {
  return table.seats.filter(
    (s): s is SeatPlayer => s !== null && s.isActive && !s.isSittingOut,
  );
}

export function getActiveNonAllInPlayers(table: TableState): SeatPlayer[] {
  return getActivePlayers(table).filter(p => !p.isAllIn);
}

export function getHighestBet(table: TableState): number {
  let max = 0;
  for (const seat of table.seats) {
    if (seat && seat.currentBet > max) max = seat.currentBet;
  }
  return max;
}

export function getCurrentPlayer(table: TableState): SeatPlayer | null {
  return table.seats[table.currentPlayerSeatIndex] ?? null;
}

export function validateAction(
  table: TableState,
  player: SeatPlayer,
  action: BettingAction,
  amount?: number,
): string | null {
  const currentBet = getHighestBet(table);
  const toCall = currentBet - player.currentBet;

  switch (action) {
    case 'fold':
      return null;

    case 'check':
      if (toCall > 0) return 'You cannot check — there is a bet to match. Use !call or !fold.';
      return null;

    case 'call':
      if (toCall === 0) return 'Nothing to call. Did you mean !check?';
      return null;

    case 'raise': {
      if (amount === undefined) return 'You must specify a raise amount. Usage: !raise <amount>';
      const minRaise = currentBet + table.currentMinRaise;
      if (amount < minRaise && amount < player.chipStack + player.currentBet) {
        return `Minimum raise is ${minRaise}. Use !all-in to bet everything.`;
      }
      if (amount > player.chipStack + player.currentBet) {
        return `You don't have enough chips. Your stack: ${player.chipStack}. Use !all-in to bet everything.`;
      }
      return null;
    }

    case 'all_in':
      if (player.chipStack === 0) return 'You have no chips to bet.';
      return null;
  }
}

export function applyAction(
  table: TableState,
  player: SeatPlayer,
  action: BettingAction,
  amount?: number,
): { betAmount: number } {
  const currentBet = getHighestBet(table);
  let betAmount = 0;

  switch (action) {
    case 'fold':
      player.isActive = false;
      player.hasActed = true;
      break;

    case 'check':
      player.hasActed = true;
      break;

    case 'call': {
      const toCall = Math.min(currentBet - player.currentBet, player.chipStack);
      player.chipStack -= toCall;
      player.currentBet += toCall;
      player.hasActed = true;
      betAmount = toCall;
      if (player.chipStack === 0) player.isAllIn = true;
      break;
    }

    case 'raise': {
      const raiseTotal = amount!;
      const additionalBet = raiseTotal - player.currentBet;
      const actualBet = Math.min(additionalBet, player.chipStack);
      player.chipStack -= actualBet;
      player.currentBet += actualBet;
      player.hasActed = true;
      betAmount = actualBet;
      if (player.chipStack === 0) player.isAllIn = true;

      // Update min raise (the raise increment)
      const raiseIncrement = player.currentBet - currentBet;
      if (raiseIncrement > 0) {
        table.currentMinRaise = Math.max(table.currentMinRaise, raiseIncrement);
      }
      table.lastRaiseSeatIndex = player.seatIndex;

      // Reset hasActed for all other active non-all-in players
      for (const seat of table.seats) {
        if (seat && seat !== player && seat.isActive && !seat.isAllIn) {
          seat.hasActed = false;
        }
      }
      break;
    }

    case 'all_in': {
      const allInAmount = player.chipStack;
      player.currentBet += allInAmount;
      player.chipStack = 0;
      player.isAllIn = true;
      player.hasActed = true;
      betAmount = allInAmount;

      // If this is effectively a raise (above current bet)
      if (player.currentBet > currentBet) {
        const raiseIncrement = player.currentBet - currentBet;
        // Only reopen action if it's a full raise
        if (raiseIncrement >= table.currentMinRaise) {
          table.currentMinRaise = Math.max(table.currentMinRaise, raiseIncrement);
          table.lastRaiseSeatIndex = player.seatIndex;
          for (const seat of table.seats) {
            if (seat && seat !== player && seat.isActive && !seat.isAllIn) {
              seat.hasActed = false;
            }
          }
        }
      }
      break;
    }
  }

  // Record action in history
  table.actionHistory.push({
    playerId: player.profileId,
    action,
    amount: betAmount,
    timestamp: Date.now(),
  });

  return { betAmount };
}

export function advanceToNextPlayer(table: TableState): void {
  const activeNonAllIn = getActiveNonAllInPlayers(table);
  if (activeNonAllIn.length === 0) return;

  let seat = nextOccupiedSeat(table, table.currentPlayerSeatIndex);
  const start = seat;
  do {
    const player = table.seats[seat];
    if (player && player.isActive && !player.isAllIn && !player.isSittingOut) {
      table.currentPlayerSeatIndex = seat;
      return;
    }
    seat = nextOccupiedSeat(table, seat);
  } while (seat !== start);
}

export function isBettingRoundComplete(table: TableState): boolean {
  const activePlayers = getActivePlayers(table);

  // Only one player left — hand over
  if (activePlayers.length <= 1) return true;

  const activeNonAllIn = activePlayers.filter(p => !p.isAllIn);

  // Everyone is all-in (or all but one)
  if (activeNonAllIn.length <= 1) {
    // Check if the one remaining player has matched the bet
    if (activeNonAllIn.length === 1) {
      const player = activeNonAllIn[0];
      const highestBet = getHighestBet(table);
      return player.hasActed && player.currentBet >= highestBet;
    }
    return true;
  }

  // All active non-all-in players have acted and matched the highest bet
  const highestBet = getHighestBet(table);
  return activeNonAllIn.every(p => p.hasActed && p.currentBet >= highestBet);
}

export function resetBettingRound(table: TableState): void {
  for (const seat of table.seats) {
    if (seat) {
      seat.currentBet = 0;
      seat.hasActed = false;
    }
  }
  table.currentMinRaise = table.config.bigBlind;
  table.lastRaiseSeatIndex = -1;
}

export function onlyOnePlayerActive(table: TableState): boolean {
  return getActivePlayers(table).length <= 1;
}
