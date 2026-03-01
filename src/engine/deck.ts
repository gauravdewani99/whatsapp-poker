import { randomInt } from 'node:crypto';
import type { CardString, Suit, Rank } from '../models/card.js';

const SUITS: Suit[] = ['h', 'd', 'c', 's'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export class Deck {
  private cards: CardString[];
  private index: number;

  constructor() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(`${rank}${suit}` as CardString);
      }
    }
    this.index = 0;
    this.shuffle();
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.index = 0;
  }

  deal(count: number = 1): CardString[] {
    if (this.index + count > this.cards.length) {
      throw new Error('Not enough cards in deck');
    }
    const dealt = this.cards.slice(this.index, this.index + count);
    this.index += count;
    return dealt;
  }

  burn(): void {
    if (this.index >= this.cards.length) {
      throw new Error('No cards left to burn');
    }
    this.index++;
  }

  get remaining(): number {
    return this.cards.length - this.index;
  }
}
