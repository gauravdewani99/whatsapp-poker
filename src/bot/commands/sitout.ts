import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import type { SeatPlayer } from '../../models/player.js';

export function registerSitoutCommands(registry: CommandRegistry): void {
  registry.register('sitout', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    const seat = table.seats.find(
      (s): s is SeatPlayer => s !== null && s.waId === command.senderWaId,
    );

    if (!seat) {
      return { error: 'You are not seated at this table.' };
    }

    if (seat.isSittingOut) {
      return { error: 'You are already sitting out.' };
    }

    // If mid-hand and still active, auto-fold first
    if (table.phase !== 'waiting' && table.phase !== 'showdown' && seat.isActive) {
      seat.isActive = false;
    }

    seat.isSittingOut = true;

    return {
      groupMessage: `\uD83D\uDCA4 *${seat.displayName}* is sitting out. Use !sitin to return.`,
    };
  });

  registry.register('sitin', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    const seat = table.seats.find(
      (s): s is SeatPlayer => s !== null && s.waId === command.senderWaId,
    );

    if (!seat) {
      return { error: 'You are not seated at this table.' };
    }

    if (!seat.isSittingOut) {
      return { error: 'You are not sitting out.' };
    }

    seat.isSittingOut = false;

    return {
      groupMessage: `\u2705 *${seat.displayName}* is back in. Dealt in next hand.`,
    };
  });
}
