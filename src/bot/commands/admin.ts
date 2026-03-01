import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { GameRepository } from '../../db/repositories/game-repo.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import type { SeatPlayer } from '../../models/player.js';
import { formatChips } from '../../messages/formatter.js';
import { clearTurnTimer } from './turn-timer-helper.js';

export function registerAdminCommands(registry: CommandRegistry): void {
  // !poker stop - end the session
  registry.register('stop', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    if (table.creatorWaId !== command.senderWaId) {
      return { error: 'Only the table creator can stop the game.' };
    }

    // Return all chips to players
    const playerRepo = new PlayerRepository(db);
    for (const seat of table.seats) {
      if (!seat) continue;
      const profile = playerRepo.findByWaId(seat.waId);
      if (profile) {
        playerRepo.updateBalance(profile.id, profile.chipBalance + seat.chipStack);
      }
    }

    // End game in DB
    const gameRepo = new GameRepository(db);
    gameRepo.endGame(table.gameId);

    // Clear turn timer and remove table
    clearTurnTimer(registry, command.groupId);
    tm.removeTable(command.groupId);

    return {
      groupMessage: `\uD83D\uDED1 *Table closed by ${command.senderName}*. All chips have been returned.`,
    };
  });

  // !poker kick @player
  registry.register('kick', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    if (table.creatorWaId !== command.senderWaId) {
      return { error: 'Only the table creator can kick players.' };
    }

    const targetName = command.args.join(' ').replace('@', '').trim();
    if (!targetName) {
      return { error: 'Usage: !poker kick <player_name>' };
    }

    const seatIdx = table.seats.findIndex(
      s => s?.displayName.toLowerCase() === targetName.toLowerCase(),
    );

    if (seatIdx === -1) {
      return { error: `Player "${targetName}" not found at this table.` };
    }

    const seat = table.seats[seatIdx] as SeatPlayer;

    // Return chips
    const playerRepo = new PlayerRepository(db);
    const profile = playerRepo.findByWaId(seat.waId);
    if (profile) {
      playerRepo.updateBalance(profile.id, profile.chipBalance + seat.chipStack);
    }

    table.seats[seatIdx] = null;

    return {
      groupMessage: `\u26D4 *${seat.displayName}* has been removed from the table by ${command.senderName}. Chips returned: ${formatChips(seat.chipStack)}.`,
    };
  });
}
