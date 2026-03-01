import { describe, it, expect } from 'vitest';
import { PotManager } from '../../../src/engine/pot-manager.js';
import type { SeatPlayer } from '../../../src/models/player.js';

function makePlayer(id: number, currentBet: number, isActive: boolean, isAllIn: boolean = false): SeatPlayer {
  return {
    profileId: id,
    waId: `${id}@c.us`,
    displayName: `Player${id}`,
    seatIndex: id - 1,
    chipStack: 10000 - currentBet,
    holeCards: null,
    isActive,
    isSittingOut: false,
    isAllIn,
    currentBet,
    hasActed: true,
  };
}

describe('PotManager', () => {
  it('creates single main pot when no all-in', () => {
    const pm = new PotManager();
    const players = [
      makePlayer(1, 200, true),
      makePlayer(2, 200, true),
      makePlayer(3, 200, true),
    ];
    pm.collectBets(players);
    const state = pm.state;
    expect(state.pots.length).toBe(1);
    expect(state.totalAmount).toBe(600);
    expect(state.pots[0].eligiblePlayerIds).toEqual([1, 2, 3]);
  });

  it('creates side pot when one player all-in for less', () => {
    const pm = new PotManager();
    const players = [
      makePlayer(1, 100, true, true),  // all-in 100
      makePlayer(2, 200, true),
      makePlayer(3, 200, true),
    ];
    pm.collectBets(players);
    const state = pm.state;
    expect(state.pots.length).toBe(2);
    expect(state.pots[0].amount).toBe(300);  // 100 * 3
    expect(state.pots[0].eligiblePlayerIds).toEqual([1, 2, 3]);
    expect(state.pots[1].amount).toBe(200);  // 100 * 2
    expect(state.pots[1].eligiblePlayerIds).toEqual([2, 3]);
    expect(state.totalAmount).toBe(500);
  });

  it('creates multiple side pots', () => {
    const pm = new PotManager();
    const players = [
      makePlayer(1, 50, true, true),   // all-in 50
      makePlayer(2, 150, true, true),  // all-in 150
      makePlayer(3, 300, true),
    ];
    pm.collectBets(players);
    const state = pm.state;
    expect(state.pots.length).toBe(3);
    expect(state.pots[0].amount).toBe(150);  // 50 * 3
    expect(state.pots[1].amount).toBe(200);  // 100 * 2
    expect(state.pots[2].amount).toBe(150);  // 150 * 1
    expect(state.totalAmount).toBe(500);
  });

  it('excludes folded players from pot eligibility', () => {
    const pm = new PotManager();
    const players = [
      makePlayer(1, 200, false), // folded but bet 200
      makePlayer(2, 200, true),
      makePlayer(3, 200, true),
    ];
    pm.collectBets(players);
    const state = pm.state;
    expect(state.pots.length).toBe(1);
    expect(state.totalAmount).toBe(600);
    expect(state.pots[0].eligiblePlayerIds).toEqual([2, 3]); // folded player not eligible
  });

  it('accumulates across multiple betting rounds', () => {
    const pm = new PotManager();
    // Round 1: everyone bets 100
    pm.collectBets([
      makePlayer(1, 100, true),
      makePlayer(2, 100, true),
      makePlayer(3, 100, true),
    ]);
    // Round 2: everyone bets 200 more
    pm.collectBets([
      makePlayer(1, 200, true),
      makePlayer(2, 200, true),
      makePlayer(3, 200, true),
    ]);
    const state = pm.state;
    expect(state.totalAmount).toBe(900);
  });

  it('resets pots', () => {
    const pm = new PotManager();
    pm.collectBets([makePlayer(1, 100, true), makePlayer(2, 100, true)]);
    pm.reset();
    expect(pm.state.totalAmount).toBe(0);
    expect(pm.state.pots.length).toBe(0);
  });

  it('handles zero bets gracefully', () => {
    const pm = new PotManager();
    pm.collectBets([makePlayer(1, 0, true), makePlayer(2, 0, true)]);
    expect(pm.state.totalAmount).toBe(0);
  });
});
