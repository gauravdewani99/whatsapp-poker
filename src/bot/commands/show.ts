import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { renderCards } from '../../messages/card-renderer.js';

export function registerShowCommand(registry: CommandRegistry): void {
  registry.register('show', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    if (table.phase !== 'showdown') {
      return { error: 'You can only show your cards after a hand ends.' };
    }

    const seat = table.seats.find(s => s?.waId === command.senderWaId);
    if (!seat) {
      return { error: 'You are not seated at this table.' };
    }

    if (!seat.holeCards) {
      return { error: 'You have no cards to show.' };
    }

    return {
      groupMessage: `👀 *${seat.displayName}* shows: ${renderCards(seat.holeCards)}`,
    };
  });
}
