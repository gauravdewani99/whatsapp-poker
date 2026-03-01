import pokersolver, { type Hand as HandType } from 'pokersolver';
const { Hand } = pokersolver;
import type { CardString } from '../models/card.js';

export interface EvaluatedHand {
  playerId: number;
  cards: CardString[];
  bestHand: string[];
  handName: string;
  handDescription: string;
  rank: number;
  solvedHand: HandType;
}

export function evaluateHand(
  playerId: number,
  holeCards: [CardString, CardString],
  communityCards: CardString[],
): EvaluatedHand {
  const allCards = [...holeCards, ...communityCards];
  // pokersolver expects uppercase suits
  const solverCards = allCards.map(c => c[0] + c[1].toUpperCase());
  const solved = Hand.solve(solverCards, 'standard');

  return {
    playerId,
    cards: allCards,
    bestHand: solved.cards,
    handName: solved.name,
    handDescription: solved.descr,
    rank: solved.rank,
    solvedHand: solved,
  };
}

export function determineWinners(evaluatedHands: EvaluatedHand[]): EvaluatedHand[] {
  if (evaluatedHands.length === 0) return [];
  if (evaluatedHands.length === 1) return evaluatedHands;

  const solvedHands = evaluatedHands.map(h => h.solvedHand);
  const winnerSolved = Hand.winners(solvedHands);

  return evaluatedHands.filter(h => winnerSolved.includes(h.solvedHand));
}
