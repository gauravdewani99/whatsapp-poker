import { describe, it, expect } from 'vitest';
import { Deck } from '../../../src/engine/deck.js';

describe('Deck', () => {
  it('creates a deck with 52 cards', () => {
    const deck = new Deck();
    expect(deck.remaining).toBe(52);
  });

  it('deals unique cards', () => {
    const deck = new Deck();
    const all = deck.deal(52);
    const unique = new Set(all);
    expect(unique.size).toBe(52);
  });

  it('reduces remaining count after dealing', () => {
    const deck = new Deck();
    deck.deal(5);
    expect(deck.remaining).toBe(47);
  });

  it('burns a card', () => {
    const deck = new Deck();
    deck.burn();
    expect(deck.remaining).toBe(51);
  });

  it('throws when dealing more cards than remaining', () => {
    const deck = new Deck();
    deck.deal(50);
    expect(() => deck.deal(5)).toThrow('Not enough cards');
  });

  it('throws when burning with no cards left', () => {
    const deck = new Deck();
    deck.deal(52);
    expect(() => deck.burn()).toThrow('No cards left');
  });

  it('produces different orders on shuffle', () => {
    const deck1 = new Deck();
    const cards1 = deck1.deal(52);
    const deck2 = new Deck();
    const cards2 = deck2.deal(52);
    // Extremely unlikely to be the same
    const same = cards1.every((c, i) => c === cards2[i]);
    expect(same).toBe(false);
  });
});
