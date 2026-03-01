export class PokerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PokerError';
  }
}

export class InvalidActionError extends PokerError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidActionError';
  }
}

export class NotYourTurnError extends PokerError {
  constructor() {
    super('It is not your turn.');
    this.name = 'NotYourTurnError';
  }
}

export class GameNotFoundError extends PokerError {
  constructor() {
    super('No active game in this group. Use !poker start to create one.');
    this.name = 'GameNotFoundError';
  }
}

export class PlayerNotFoundError extends PokerError {
  constructor() {
    super('You are not seated at this table. Use !poker join to sit down.');
    this.name = 'PlayerNotFoundError';
  }
}

export class InsufficientChipsError extends PokerError {
  constructor(required: number, available: number) {
    super(`Not enough chips. Required: ${required}, Available: ${available}`);
    this.name = 'InsufficientChipsError';
  }
}
