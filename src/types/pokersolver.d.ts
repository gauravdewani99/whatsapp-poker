declare module 'pokersolver' {
  export class Hand {
    cardPool: string[];
    cards: string[];
    descr: string;
    name: string;
    rank: number;
    static solve(cards: string[], game?: string, canDisqualify?: boolean): Hand;
    static winners(hands: Hand[]): Hand[];
    toString(): string;
  }

  const pokersolver: { Hand: typeof Hand };
  export default pokersolver;
}
