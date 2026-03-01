import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { GameRepository } from '../../db/repositories/game-repo.js';
import { getOccupiedSeats } from '../../engine/blinds.js';
import { startTurnTimer } from './turn-timer-helper.js';
import { logger } from '../../utils/logger.js';

export function registerDealCommand(registry: CommandRegistry): void {
  registry.register('deal', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table. Use !poker start to create one.' };
    }

    if (table.phase !== 'waiting' && table.phase !== 'showdown') {
      return { error: 'A hand is already in progress.' };
    }

    const activePlayers = getOccupiedSeats(table);
    if (activePlayers.length < 2) {
      return { error: 'Need at least 2 players to deal. Tell your friends to !poker join.' };
    }

    // Mark game as active if first hand
    if (table.handNumber === 0) {
      try {
        const gameRepo = new GameRepository(db);
        gameRepo.startGame(table.gameId);
      } catch (err) {
        logger.error({ err, groupId: command.groupId }, 'Failed to mark game as started in DB');
      }
    }

    // Create a new round and start the hand
    try {
      const round = tm.createNewRound(command.groupId);
      const result = round.startNewHand();

      // Start turn timer for first-to-act
      startTurnTimer(registry, command.groupId);

      return result;
    } catch (err) {
      logger.error({ err, groupId: command.groupId }, 'Failed to deal new hand');
      return { error: 'Something went wrong while dealing. Please try again.' };
    }
  });
}
