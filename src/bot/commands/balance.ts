import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import * as templates from '../../messages/templates.js';

export function registerBalanceCommand(registry: CommandRegistry): void {
  registry.register('balance', (command: ParsedCommand): CommandResult => {
    const db = registry.getDB();
    const playerRepo = new PlayerRepository(db);
    const profile = playerRepo.findByWaId(command.senderWaId);

    if (!profile) {
      return { error: 'You have not played yet. Join a table first!' };
    }

    // Also check table stack if seated
    const tm = registry.getTableManager();
    const table = tm.getTable(command.groupId);
    const seat = table?.seats.find(s => s?.waId === command.senderWaId);
    const tableStack = seat ? seat.chipStack : 0;

    let msg = templates.balanceMessage(command.senderName, profile.chipBalance);
    if (seat) {
      msg += `\nTable stack: *${tableStack.toLocaleString()}*`;
    }

    return { groupMessage: msg };
  });
}
