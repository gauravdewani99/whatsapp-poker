export interface Pot {
  amount: number;
  eligiblePlayerIds: number[];
}

export interface PotState {
  pots: Pot[];
  totalAmount: number;
}

export function emptyPotState(): PotState {
  return { pots: [], totalAmount: 0 };
}
