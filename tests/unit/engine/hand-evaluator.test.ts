import { describe, it, expect } from 'vitest';
import { evaluateHand, determineWinners } from '../../../src/engine/hand-evaluator.js';
import type { CardString } from '../../../src/models/card.js';

describe('Hand Evaluator', () => {
  it('identifies a Royal Flush', () => {
    const result = evaluateHand(1, ['Ah', 'Kh'] as [CardString, CardString], ['Qh', 'Jh', 'Th', '2c', '3d'] as CardString[]);
    expect(result.handName).toBe('Straight Flush'); // pokersolver names Royal Flush as Straight Flush
    expect(result.handDescription).toContain('Royal');
  });

  it('identifies a Straight Flush', () => {
    const result = evaluateHand(1, ['9h', '8h'] as [CardString, CardString], ['7h', '6h', '5h', '2c', '3d'] as CardString[]);
    expect(result.handName).toBe('Straight Flush');
  });

  it('identifies Four of a Kind', () => {
    const result = evaluateHand(1, ['8h', '8d'] as [CardString, CardString], ['8c', '8s', '5h', '2c', '3d'] as CardString[]);
    expect(result.handName).toBe('Four of a Kind');
  });

  it('identifies a Full House', () => {
    const result = evaluateHand(1, ['Kh', 'Kd'] as [CardString, CardString], ['Kc', '7s', '7h', '2c', '3d'] as CardString[]);
    expect(result.handName).toBe('Full House');
  });

  it('identifies a Flush', () => {
    const result = evaluateHand(1, ['Ah', '9h'] as [CardString, CardString], ['6h', '4h', '2h', 'Kc', '3d'] as CardString[]);
    expect(result.handName).toBe('Flush');
  });

  it('identifies a Straight', () => {
    const result = evaluateHand(1, ['9h', '8d'] as [CardString, CardString], ['7c', '6s', '5h', '2c', 'Ad'] as CardString[]);
    expect(result.handName).toBe('Straight');
  });

  it('identifies a Wheel (A-2-3-4-5)', () => {
    const result = evaluateHand(1, ['Ah', '2d'] as [CardString, CardString], ['3c', '4s', '5h', '9c', 'Kd'] as CardString[]);
    expect(result.handName).toBe('Straight');
  });

  it('identifies Three of a Kind', () => {
    const result = evaluateHand(1, ['Jh', 'Jd'] as [CardString, CardString], ['Jc', '4s', '8h', '2c', 'Kd'] as CardString[]);
    expect(result.handName).toBe('Three of a Kind');
  });

  it('identifies Two Pair', () => {
    const result = evaluateHand(1, ['Ah', 'Ad'] as [CardString, CardString], ['Kc', 'Ks', '8h', '2c', '3d'] as CardString[]);
    expect(result.handName).toBe('Two Pair');
  });

  it('identifies One Pair', () => {
    const result = evaluateHand(1, ['Qh', 'Qd'] as [CardString, CardString], ['8c', '4s', '2h', 'Kc', '3d'] as CardString[]);
    expect(result.handName).toBe('Pair');
  });

  it('identifies High Card', () => {
    const result = evaluateHand(1, ['Ah', 'Kd'] as [CardString, CardString], ['9c', '4s', '2h', '7c', '3d'] as CardString[]);
    expect(result.handName).toBe('High Card');
  });

  it('determines the correct winner', () => {
    const hand1 = evaluateHand(1, ['Ah', 'Kh'] as [CardString, CardString], ['Qh', 'Jh', 'Th', '2c', '3d'] as CardString[]);
    const hand2 = evaluateHand(2, ['9c', '8c'] as [CardString, CardString], ['Qh', 'Jh', 'Th', '2c', '3d'] as CardString[]);
    const winners = determineWinners([hand1, hand2]);
    expect(winners.length).toBe(1);
    expect(winners[0].playerId).toBe(1);
  });

  it('handles a split pot (identical hands)', () => {
    const community = ['Qh', 'Jh', 'Th', '2c', '3d'] as CardString[];
    const hand1 = evaluateHand(1, ['Ah', 'Kd'] as [CardString, CardString], community);
    const hand2 = evaluateHand(2, ['As', 'Kc'] as [CardString, CardString], community);
    const winners = determineWinners([hand1, hand2]);
    expect(winners.length).toBe(2);
  });

  it('breaks ties with kickers', () => {
    const community = ['2h', '5d', '8c', 'Ts', '3h'] as CardString[];
    const hand1 = evaluateHand(1, ['Ah', 'Kd'] as [CardString, CardString], community);
    const hand2 = evaluateHand(2, ['As', 'Qc'] as [CardString, CardString], community);
    const winners = determineWinners([hand1, hand2]);
    expect(winners.length).toBe(1);
    expect(winners[0].playerId).toBe(1); // A-K kicker beats A-Q
  });

  it('selects best 5 from 7 cards', () => {
    const result = evaluateHand(1, ['Ah', 'Kh'] as [CardString, CardString], ['Qh', 'Jh', 'Th', '9h', '8h'] as CardString[]);
    expect(result.handName).toBe('Straight Flush');
    expect(result.handDescription).toContain('Royal');
  });
});
