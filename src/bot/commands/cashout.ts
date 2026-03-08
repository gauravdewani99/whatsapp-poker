import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import type { SeatPlayer } from '../../models/player.js';
import { formatChips } from '../../messages/formatter.js';

export function registerCashoutCommand(registry: CommandRegistry): void {
  registry.register('cashout', async (command: ParsedCommand): Promise<CommandResult> => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    const seatIdx = table.seats.findIndex(s => s?.waId === command.senderWaId);
    if (seatIdx === -1) {
      return { error: 'You are not seated at this table.' };
    }

    const seat = table.seats[seatIdx] as SeatPlayer;

    if (table.phase !== 'waiting' && table.phase !== 'showdown' && seat.isActive) {
      return { error: 'Cannot cash out during an active hand. Wait for the hand to finish or !fold first.' };
    }

    const cashoutAmount = seat.chipStack;
    const playerRepo = new PlayerRepository(db);
    const profile = await playerRepo.findByWaId(command.senderWaId);
    if (profile) {
      await playerRepo.updateBalance(profile.id, profile.chipBalance + cashoutAmount);
    }

    table.seats[seatIdx] = null;

    return {
      groupMessage: `\uD83D\uDCB0 *${seat.displayName}* cashed out with *${formatChips(cashoutAmount)}* chips.`,
    };
  });
}
