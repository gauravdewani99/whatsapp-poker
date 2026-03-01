import type { CardString } from '../models/card.js';

const SUIT_EMOJI: Record<string, string> = {
  h: '\u2665\uFE0F', // ♥️
  d: '\u2666\uFE0F', // ♦️
  c: '\u2663\uFE0F', // ♣️
  s: '\u2660\uFE0F', // ♠️
};

const RANK_DISPLAY: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10',
  'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

export function renderCard(card: CardString): string {
  const rank = RANK_DISPLAY[card[0]] || card[0];
  const suit = SUIT_EMOJI[card[1]] || card[1];
  return `${rank}${suit}`;
}

export function renderCards(cards: CardString[]): string {
  return cards.map(renderCard).join('  ');
}

export function renderHiddenCards(): string {
  return '\uD83C\uDCA0 \uD83C\uDCA0';
}
