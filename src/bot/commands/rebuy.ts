import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import type { SeatPlayer } from '../../models/player.js';
import { formatChips } from '../../messages/formatter.js';

export function registerRebuyCommand(registry: CommandRegistry): void {
  registry.register('rebuy', async (command: ParsedCommand): Promise<CommandResult> => {
    const tm = registry.getTableManager();
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

    // Dynamic max: 2x the current max stack at the table, or the table's maxBuyIn — whichever is higher
    const maxStack = Math.max(
      ...table.seats
        .filter((s): s is SeatPlayer => s !== null)
        .map(s => s.chipStack),
    );
    const dynamicMax = Math.max(maxStack * 2, table.config.maxBuyIn);

    const amount = command.args[0] ? parseInt(command.args[0], 10) : table.config.minBuyIn;
    if (isNaN(amount) || amount <= 0) {
      return { error: 'Usage: !rebuy <amount>' };
    }

    if (amount < table.config.minBuyIn || amount > dynamicMax) {
      return {
        error: `Rebuy must be between ${formatChips(table.config.minBuyIn)} and ${formatChips(dynamicMax)}.`,
      };
    }

    // Add to stack + track total buy-in (no wallet deduction — rebuys are always allowed)
    seat.chipStack += amount;
    seat.buyInAmount += amount;

    return {
      groupMessage: `\u267B\uFE0F *${command.senderName}* rebuys for *${formatChips(amount)}*. Stack: ${formatChips(seat.chipStack)}`,
    };
  });
}
