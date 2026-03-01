export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type CardString = `${Rank}${Suit}`;

export const SUITS: Suit[] = ['h', 'd', 'c', 's'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export function cardToString(card: Card): CardString {
  return `${card.rank}${card.suit}` as CardString;
}

export function stringToCard(s: CardString): Card {
  return { rank: s[0] as Rank, suit: s[1] as Suit };
}
