import { describe, it, expect, beforeEach } from 'vitest';
import { TableManager } from '../../src/state/table-manager.js';
import { createDefaultConfig } from '../../src/models/game.js';
import { createSeatPlayer, type PlayerProfile } from '../../src/models/player.js';
import type { SeatPlayer } from '../../src/models/player.js';

function makeProfile(id: number, name: string): PlayerProfile {
  return {
    id,
    waId: `${id}@c.us`,
    displayName: name,
    chipBalance: 100000,
    totalBuyIn: 0,
    totalCashOut: 0,
    handsPlayed: 0,
    handsWon: 0,
  };
}

describe('Game Round Integration', () => {
  let tm: TableManager;
  const groupId = 'test-group@g.us';

  beforeEach(() => {
    tm = new TableManager();
  });

  it('plays a complete hand with 3 players - fold to win', () => {
    const config = createDefaultConfig(groupId, 50, 100);
    tm.createTable(groupId, config, 1, '1@c.us');
    const table = tm.getTable(groupId)!;

    // Seat 3 players
    const p1 = makeProfile(1, 'Alice');
    const p2 = makeProfile(2, 'Bob');
    const p3 = makeProfile(3, 'Charlie');

    table.seats[0] = createSeatPlayer(p1, 0, 10000);
    table.seats[1] = createSeatPlayer(p2, 1, 10000);
    table.seats[2] = createSeatPlayer(p3, 2, 10000);

    // Deal
    const round = tm.createNewRound(groupId);
    const dealResult = round.startNewHand();

    expect(dealResult.groupMessage).toBeDefined();
    expect(dealResult.privateMessages).toHaveLength(3);
    expect(table.phase).toBe('preflop');
    expect(table.handNumber).toBe(1);

    // Each player should have been dealt 2 cards
    for (const seat of table.seats) {
      if (seat) {
        expect(seat.holeCards).toHaveLength(2);
      }
    }

    // Identify who needs to act (first to act preflop is left of BB)
    const currentPlayer = table.seats[table.currentPlayerSeatIndex]!;

    // Player folds
    const foldResult = round.processAction(currentPlayer.waId, 'fold');
    expect(foldResult.groupMessage).toBeDefined();
    expect(foldResult.error).toBeUndefined();

    // Next player folds too
    const nextPlayer = table.seats[table.currentPlayerSeatIndex]!;
    const fold2Result = round.processAction(nextPlayer.waId, 'fold');

    // Hand should be over - only one player left
    expect(table.phase).toBe('showdown');
    expect(fold2Result.groupMessage).toContain('wins');
  });

  it('plays a hand through to showdown', () => {
    const config = createDefaultConfig(groupId, 50, 100);
    tm.createTable(groupId, config, 1, '1@c.us');
    const table = tm.getTable(groupId)!;

    table.seats[0] = createSeatPlayer(makeProfile(1, 'Alice'), 0, 10000);
    table.seats[1] = createSeatPlayer(makeProfile(2, 'Bob'), 1, 10000);

    const round = tm.createNewRound(groupId);
    round.startNewHand();

    expect(table.phase).toBe('preflop');

    // Heads-up: dealer (seat 0) is SB and acts first preflop
    let current = table.seats[table.currentPlayerSeatIndex]!;

    // SB calls (matches BB)
    round.processAction(current.waId, 'call');

    // BB checks (option)
    current = table.seats[table.currentPlayerSeatIndex]!;
    round.processAction(current.waId, 'check');

    // Should be on flop now
    expect(table.phase).toBe('flop');
    expect(table.communityCards.length).toBe(3);

    // Flop betting: BB acts first postflop in heads-up
    current = table.seats[table.currentPlayerSeatIndex]!;
    round.processAction(current.waId, 'check');

    current = table.seats[table.currentPlayerSeatIndex]!;
    round.processAction(current.waId, 'check');

    // Turn
    expect(table.phase).toBe('turn');
    expect(table.communityCards.length).toBe(4);

    current = table.seats[table.currentPlayerSeatIndex]!;
    round.processAction(current.waId, 'check');

    current = table.seats[table.currentPlayerSeatIndex]!;
    round.processAction(current.waId, 'check');

    // River
    expect(table.phase).toBe('river');
    expect(table.communityCards.length).toBe(5);

    current = table.seats[table.currentPlayerSeatIndex]!;
    round.processAction(current.waId, 'check');

    current = table.seats[table.currentPlayerSeatIndex]!;
    const riverResult = round.processAction(current.waId, 'check');

    // Should go to showdown
    expect(table.phase).toBe('showdown');
    expect(riverResult.groupMessage).toContain('SHOWDOWN');
  });

  it('handles raise and call correctly', () => {
    const config = createDefaultConfig(groupId, 50, 100);
    tm.createTable(groupId, config, 1, '1@c.us');
    const table = tm.getTable(groupId)!;

    table.seats[0] = createSeatPlayer(makeProfile(1, 'Alice'), 0, 10000);
    table.seats[1] = createSeatPlayer(makeProfile(2, 'Bob'), 1, 10000);
    table.seats[2] = createSeatPlayer(makeProfile(3, 'Charlie'), 2, 10000);

    const round = tm.createNewRound(groupId);
    round.startNewHand();

    // First to act raises
    let current = table.seats[table.currentPlayerSeatIndex]!;
    const raiseResult = round.processAction(current.waId, 'raise', 300);
    expect(raiseResult.error).toBeUndefined();
    expect(raiseResult.groupMessage).toContain('raises');

    // Next player calls
    current = table.seats[table.currentPlayerSeatIndex]!;
    const callResult = round.processAction(current.waId, 'call');
    expect(callResult.error).toBeUndefined();

    // Last player calls (BB)
    current = table.seats[table.currentPlayerSeatIndex]!;
    round.processAction(current.waId, 'call');

    // Should advance to flop
    expect(table.phase).toBe('flop');
  });

  it('rejects actions from wrong player', () => {
    const config = createDefaultConfig(groupId, 50, 100);
    tm.createTable(groupId, config, 1, '1@c.us');
    const table = tm.getTable(groupId)!;

    table.seats[0] = createSeatPlayer(makeProfile(1, 'Alice'), 0, 10000);
    table.seats[1] = createSeatPlayer(makeProfile(2, 'Bob'), 1, 10000);

    const round = tm.createNewRound(groupId);
    round.startNewHand();

    // Try to act as the wrong player
    const current = table.seats[table.currentPlayerSeatIndex]!;
    const otherWaId = current.waId === '1@c.us' ? '2@c.us' : '1@c.us';
    const result = round.processAction(otherWaId, 'check');
    expect(result.error).toContain('not your turn');
  });

  it('validates illegal actions', () => {
    const config = createDefaultConfig(groupId, 50, 100);
    tm.createTable(groupId, config, 1, '1@c.us');
    const table = tm.getTable(groupId)!;

    table.seats[0] = createSeatPlayer(makeProfile(1, 'Alice'), 0, 10000);
    table.seats[1] = createSeatPlayer(makeProfile(2, 'Bob'), 1, 10000);
    table.seats[2] = createSeatPlayer(makeProfile(3, 'Charlie'), 2, 10000);

    const round = tm.createNewRound(groupId);
    round.startNewHand();

    // First to act tries to check (there's a BB to call)
    const current = table.seats[table.currentPlayerSeatIndex]!;
    const result = round.processAction(current.waId, 'check');
    expect(result.error).toContain('cannot check');
  });

  it('handles all-in correctly', () => {
    const config = createDefaultConfig(groupId, 50, 100);
    tm.createTable(groupId, config, 1, '1@c.us');
    const table = tm.getTable(groupId)!;

    table.seats[0] = createSeatPlayer(makeProfile(1, 'Alice'), 0, 500);
    table.seats[1] = createSeatPlayer(makeProfile(2, 'Bob'), 1, 10000);

    const round = tm.createNewRound(groupId);
    round.startNewHand();

    // SB (dealer in heads-up) goes all-in
    let current = table.seats[table.currentPlayerSeatIndex]!;
    const allInResult = round.processAction(current.waId, 'all_in');
    expect(allInResult.error).toBeUndefined();
    expect(allInResult.groupMessage).toContain('ALL-IN');

    // BB calls
    current = table.seats[table.currentPlayerSeatIndex]!;
    const callResult = round.processAction(current.waId, 'call');

    // RIM feature: game pauses for run-it-multiple vote instead of auto-dealing
    expect(table.rimState).toBeTruthy();
    expect(table.rimState!.savedDeck.length).toBeGreaterThan(0);

    // Simulate choosing to run it once
    const messages = round.executeRimRunout(1);
    expect(messages.length).toBeGreaterThan(0);

    // Should now be at showdown with 5 community cards
    expect(table.phase).toBe('showdown');
    expect(table.communityCards.length).toBe(5);
  });
});
