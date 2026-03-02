import type { TableState } from '../models/table.js';
import type { BettingAction, GamePhase } from '../models/game.js';
import type { CardString } from '../models/card.js';
import type { SeatPlayer } from '../models/player.js';
import type { CommandResult } from '../models/command.js';
import { emptyPotState } from '../models/pot.js';
import { Deck } from './deck.js';
import { PotManager } from './pot-manager.js';
import { evaluateHand, determineWinners, type EvaluatedHand } from './hand-evaluator.js';
import {
  getBlindPositions, postBlinds, advanceDealer, getOccupiedSeats,
  type BlindPositions,
} from './blinds.js';
import {
  validateAction, applyAction, advanceToNextPlayer,
  isBettingRoundComplete, resetBettingRound, getActivePlayers,
  onlyOnePlayerActive, getHighestBet, getActiveNonAllInPlayers,
} from './betting-round.js';
import { renderCards, renderCard } from '../messages/card-renderer.js';
import * as templates from '../messages/templates.js';
import { InvalidActionError, NotYourTurnError } from '../utils/errors.js';

export interface HandResult {
  handNumber: number;
  winners: Array<{
    playerId: number;
    amount: number;
    handDescription: string;
  }>;
  communityCards: CardString[];
  playerResults: Array<{
    playerId: number;
    chipsBefore: number;
    chipsAfter: number;
    holeCards: [CardString, CardString] | null;
    finalAction: 'fold' | 'showdown' | 'win_uncontested';
  }>;
}

export class GameRound {
  private potManager: PotManager;
  private chipsBefore: Map<number, number> = new Map();

  constructor(private table: TableState) {
    this.potManager = new PotManager();
  }

  startNewHand(): CommandResult {
    if (this.table.phase !== 'waiting' && this.table.phase !== 'showdown') {
      return { error: 'A hand is already in progress.' };
    }

    const activePlayers = getOccupiedSeats(this.table);
    if (activePlayers.length < 2) {
      return { error: 'Need at least 2 players to deal.' };
    }

    // Advance dealer
    if (this.table.handNumber > 0) {
      advanceDealer(this.table);
    }

    this.table.handNumber++;
    this.table.phase = 'preflop';
    this.table.communityCards = [];
    this.table.actionHistory = [];
    this.potManager.reset();
    this.table.potState = emptyPotState();

    // Reset all players for new hand
    for (const seat of this.table.seats) {
      if (seat && !seat.isSittingOut) {
        seat.isActive = true;
        seat.isAllIn = false;
        seat.currentBet = 0;
        seat.hasActed = false;
        seat.holeCards = null;
      }
    }

    // Record starting chip stacks
    this.chipsBefore.clear();
    for (const player of activePlayers) {
      this.chipsBefore.set(player.profileId, player.chipStack);
    }

    // Create and shuffle deck
    const deck = new Deck();

    // Get blind positions
    const positions = getBlindPositions(this.table);

    // Post blinds
    postBlinds(this.table, positions);

    // Deal hole cards
    const privateMessages: Array<{ waId: string; message: string }> = [];
    for (const player of activePlayers) {
      const cards = deck.deal(2) as [CardString, CardString];
      player.holeCards = cards;
      privateMessages.push({
        waId: player.waId,
        message: templates.holeCardsMessage(this.table.handNumber, cards),
      });
    }

    // Store remaining deck in table state
    this.table.deck = [];
    while (deck.remaining > 0) {
      this.table.deck.push(...deck.deal(1));
    }

    // Set first player to act
    this.table.currentPlayerSeatIndex = positions.firstToActPreflop;
    this.table.currentMinRaise = this.table.config.bigBlind;
    this.table.lastRaiseSeatIndex = positions.bigBlindSeat;

    // BB has already "acted" (posted blind), but needs to act again if no raise
    // SB has also posted, so mark them appropriately
    const sbPlayer = this.table.seats[positions.smallBlindSeat]!;
    const bbPlayer = this.table.seats[positions.bigBlindSeat]!;
    sbPlayer.hasActed = true; // SB has contributed, will get a chance to act
    bbPlayer.hasActed = true; // BB option — will be reopened if raised

    // Reset hasActed for everyone so the preflop round works correctly
    // Everyone needs to act preflop (except BB option scenario)
    for (const seat of this.table.seats) {
      if (seat && seat.isActive && !seat.isAllIn) {
        seat.hasActed = false;
      }
    }

    const groupMessage = templates.newHandMessage(this.table, positions);

    return { groupMessage, privateMessages };
  }

  processAction(senderWaId: string, action: BettingAction, amount?: number): CommandResult {
    if (this.table.phase === 'waiting' || this.table.phase === 'showdown') {
      return { error: 'No hand in progress. Use !poker deal to start.' };
    }

    const currentPlayer = this.table.seats[this.table.currentPlayerSeatIndex];
    if (!currentPlayer) {
      return { error: 'Internal error: no current player.' };
    }

    if (currentPlayer.waId !== senderWaId) {
      return { error: `It's not your turn. Waiting for *${currentPlayer.displayName}*.` };
    }

    // Validate action
    const error = validateAction(this.table, currentPlayer, action, amount);
    if (error) return { error };

    // Apply action
    applyAction(this.table, currentPlayer, action, amount);

    let groupMessage = templates.actionMessage(currentPlayer, action, amount, this.table);

    // Check if only one player remains
    if (onlyOnePlayerActive(this.table)) {
      // Collect final bets
      this.potManager.collectBets(this.table.seats.filter((s): s is SeatPlayer => s !== null));
      resetBettingRound(this.table);

      const winner = getActivePlayers(this.table)[0];
      const totalPot = this.potManager.totalAmount;
      winner.chipStack += totalPot;

      this.table.phase = 'showdown';
      this.table.potState = this.potManager.state;

      groupMessage += '\n\n' + templates.uncontestedWinMessage(winner, totalPot);

      return { groupMessage };
    }

    // Check if betting round complete
    if (isBettingRoundComplete(this.table)) {
      // Collect bets into pots
      this.potManager.collectBets(this.table.seats.filter((s): s is SeatPlayer => s !== null));
      resetBettingRound(this.table);
      this.table.potState = this.potManager.state;

      // Advance to next phase
      const phaseResult = this.advancePhase();
      if (phaseResult) {
        if (Array.isArray(phaseResult)) {
          // All-in runout: first street appended to action message, rest sent separately
          groupMessage += '\n\n' + phaseResult[0];
          return { groupMessage: [groupMessage, ...phaseResult.slice(1)] };
        } else {
          groupMessage += '\n\n' + phaseResult;
        }
      }
    } else {
      // Advance to next player
      advanceToNextPlayer(this.table);
      const nextPlayer = this.table.seats[this.table.currentPlayerSeatIndex];
      if (nextPlayer) {
        groupMessage += `\nAction on: *${nextPlayer.displayName}*`;
      }
    }

    return { groupMessage };
  }

  private advancePhase(): string | string[] {
    const phases: GamePhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIdx = phases.indexOf(this.table.phase);
    const nextPhase = phases[currentIdx + 1];

    if (!nextPhase || nextPhase === 'showdown') {
      return this.resolveShowdown();
    }

    this.table.phase = nextPhase;

    // Check if we can skip betting (everyone all-in)
    const activeNonAllIn = getActiveNonAllInPlayers(this.table);
    const skipBetting = activeNonAllIn.length <= 1;

    // Deal community cards
    let deckIndex = 0;
    const dealFromDeck = (count: number): CardString[] => {
      const cards = this.table.deck.slice(deckIndex, deckIndex + count);
      deckIndex += count;
      return cards;
    };

    let message = '';

    // Burn and deal
    deckIndex++; // burn one card
    switch (nextPhase) {
      case 'flop': {
        const flop = dealFromDeck(3);
        this.table.communityCards.push(...flop);
        message = templates.flopMessage(flop, this.potManager.totalAmount);
        break;
      }
      case 'turn': {
        const turn = dealFromDeck(1);
        this.table.communityCards.push(...turn);
        message = templates.turnMessage(turn[0], this.table.communityCards, this.potManager.totalAmount);
        break;
      }
      case 'river': {
        const river = dealFromDeck(1);
        this.table.communityCards.push(...river);
        message = templates.riverMessage(river[0], this.table.communityCards, this.potManager.totalAmount);
        break;
      }
    }

    // Update deck pointer
    this.table.deck = this.table.deck.slice(deckIndex);

    if (skipBetting) {
      // All-in runout: send each street as a separate message for drama
      const messages: string[] = [message];
      const remainingPhases = phases.slice(phases.indexOf(nextPhase) + 1);

      for (const rp of remainingPhases) {
        if (rp === 'showdown') {
          messages.push(this.resolveShowdown());
          return messages;
        }
        this.table.phase = rp;
        let ridx = 0;
        ridx++; // burn
        switch (rp) {
          case 'flop': {
            const flop = this.table.deck.slice(ridx, ridx + 3);
            ridx += 3;
            this.table.communityCards.push(...flop);
            messages.push(templates.flopMessage(flop, this.potManager.totalAmount));
            break;
          }
          case 'turn': {
            const turn = this.table.deck.slice(ridx, ridx + 1);
            ridx += 1;
            this.table.communityCards.push(...turn);
            messages.push(templates.turnMessage(turn[0], this.table.communityCards, this.potManager.totalAmount));
            break;
          }
          case 'river': {
            const river = this.table.deck.slice(ridx, ridx + 1);
            ridx += 1;
            this.table.communityCards.push(...river);
            messages.push(templates.riverMessage(river[0], this.table.communityCards, this.potManager.totalAmount));
            break;
          }
        }
        this.table.deck = this.table.deck.slice(ridx);
      }
      return messages;
    }

    // Set first to act postflop (left of dealer)
    const positions = getBlindPositions(this.table);
    this.table.currentPlayerSeatIndex = positions.firstToActPostflop;
    // Find the first active non-all-in player from that position
    advanceToNextPlayerFromPosition(this.table, positions.firstToActPostflop);

    const nextPlayer = this.table.seats[this.table.currentPlayerSeatIndex];
    if (nextPlayer) {
      message += `\nAction on: *${nextPlayer.displayName}*`;
    }

    return message;
  }

  private resolveShowdown(): string {
    this.table.phase = 'showdown';
    const activePlayers = getActivePlayers(this.table);
    const potState = this.potManager.state;

    // Evaluate all active players' hands
    const evaluated: EvaluatedHand[] = [];
    for (const player of activePlayers) {
      if (player.holeCards) {
        evaluated.push(evaluateHand(
          player.profileId,
          player.holeCards,
          this.table.communityCards,
        ));
      }
    }

    // Distribute pots
    const winnings: Map<number, number> = new Map();
    const winnerHands: Map<number, string> = new Map();

    for (const pot of potState.pots) {
      const eligible = evaluated.filter(h => pot.eligiblePlayerIds.includes(h.playerId));
      if (eligible.length === 0) continue;

      const potWinners = determineWinners(eligible);
      const share = Math.floor(pot.amount / potWinners.length);
      const remainder = pot.amount - share * potWinners.length;

      potWinners.forEach((winner, idx) => {
        const bonus = idx === 0 ? remainder : 0; // Odd chip to first winner
        const total = (winnings.get(winner.playerId) || 0) + share + bonus;
        winnings.set(winner.playerId, total);
        winnerHands.set(winner.playerId, winner.handDescription);
      });
    }

    // Award chips
    for (const [playerId, amount] of winnings) {
      const seat = this.table.seats.find(s => s?.profileId === playerId);
      if (seat) seat.chipStack += amount;
    }

    this.table.potState = potState;

    // Build showdown message
    return templates.showdownMessage(
      this.table,
      evaluated,
      winnings,
      winnerHands,
      potState,
    );
  }

  getHandResult(): HandResult | null {
    if (this.table.phase !== 'showdown') return null;

    const winners: HandResult['winners'] = [];
    const playerResults: HandResult['playerResults'] = [];

    for (const seat of this.table.seats) {
      if (!seat) continue;
      const chipsBefore = this.chipsBefore.get(seat.profileId) ?? seat.chipStack;
      playerResults.push({
        playerId: seat.profileId,
        chipsBefore,
        chipsAfter: seat.chipStack,
        holeCards: seat.holeCards,
        finalAction: seat.isActive ? 'showdown' : 'fold',
      });
    }

    return {
      handNumber: this.table.handNumber,
      winners,
      communityCards: this.table.communityCards,
      playerResults,
    };
  }
}

function advanceToNextPlayerFromPosition(table: TableState, startSeat: number): void {
  const maxSeats = table.config.maxPlayers;
  let seat = startSeat;
  const visited = new Set<number>();

  while (!visited.has(seat)) {
    visited.add(seat);
    const player = table.seats[seat];
    if (player && player.isActive && !player.isAllIn && !player.isSittingOut) {
      table.currentPlayerSeatIndex = seat;
      return;
    }
    seat = (seat + 1) % maxSeats;
  }
}
