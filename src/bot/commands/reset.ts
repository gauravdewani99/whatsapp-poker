import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { logger } from '../../utils/logger.js';

export function registerResetCommand(registry: CommandRegistry): void {
  registry.register('reset', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    if (table.creatorWaId !== command.senderWaId) {
      return { error: 'Only the table creator can reset balances.' };
    }

    if (table.phase !== 'waiting' && table.phase !== 'showdown') {
      return { error: "Can't reset during a hand. Wait for the hand to finish." };
    }

    try {
      const playerRepo = new PlayerRepository(db);
      let count = 0;

      for (const seat of table.seats) {
        if (!seat) continue;
        const profile = playerRepo.findByWaId(seat.waId);
        if (profile) {
          playerRepo.updateBalance(profile.id, 0);
          count++;
        }
      }

      return {
        groupMessage: `🔄 All player balances have been reset to 0 by *${command.senderName}*. (${count} players affected)`,
      };
    } catch (err) {
      logger.error({ err, groupId: command.groupId }, 'Failed to reset balances');
      return { error: 'Something went wrong while resetting balances. Please try again.' };
    }
  });
}
