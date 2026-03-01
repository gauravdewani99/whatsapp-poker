import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { formatChips } from '../../messages/formatter.js';

export function registerRebuyCommand(registry: CommandRegistry): void {
  registry.register('rebuy', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table. Use !poker start to create one.' };
    }

    const seat = table.seats.find(s => s?.waId === command.senderWaId);
    if (!seat) {
      return { error: 'You are not seated at this table. Use !poker join first.' };
    }

    // Only allow rebuy between hands or when busted (0 chips)
    if (table.phase !== 'waiting' && table.phase !== 'showdown' && seat.chipStack > 0) {
      return { error: 'You can only rebuy between hands or when busted.' };
    }

    const amount = command.args[0] ? parseInt(command.args[0], 10) : table.config.minBuyIn;
    if (isNaN(amount) || amount <= 0) {
      return { error: 'Usage: !rebuy <amount>' };
    }

    if (amount < table.config.minBuyIn || amount > table.config.maxBuyIn) {
      return {
        error: `Rebuy must be between ${formatChips(table.config.minBuyIn)} and ${formatChips(table.config.maxBuyIn)}.`,
      };
    }

    const playerRepo = new PlayerRepository(db);
    const profile = playerRepo.findByWaId(command.senderWaId);
    if (!profile) {
      return { error: 'Player profile not found.' };
    }

    if (profile.chipBalance < amount) {
      return {
        error: `Insufficient balance. You have ${formatChips(profile.chipBalance)} but need ${formatChips(amount)}.`,
      };
    }

    // Deduct from balance and add to stack
    playerRepo.updateBalance(profile.id, profile.chipBalance - amount);
    seat.chipStack += amount;

    return {
      groupMessage: `\u267B\uFE0F *${command.senderName}* rebuys for *${formatChips(amount)}*. Stack: ${formatChips(seat.chipStack)}`,
    };
  });
}
