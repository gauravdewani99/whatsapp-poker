import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { createSeatPlayer } from '../../models/player.js';
import * as templates from '../../messages/templates.js';
import { config } from '../../config.js';

export function registerJoinCommand(registry: CommandRegistry): void {
  registry.register('join', async (command: ParsedCommand): Promise<CommandResult> => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table. Use !poker start <sb>/<bb> to create one.' };
    }

    // Check if already seated
    const existingSeat = table.seats.find(s => s?.waId === command.senderWaId);
    if (existingSeat) {
      return { error: 'You are already seated at this table.' };
    }

    // Parse buy-in amount
    const buyInStr = command.args[0];
    if (!buyInStr) {
      return { error: `Usage: !poker join <amount>\nBuy-in range: ${table.config.minBuyIn} - ${table.config.maxBuyIn}` };
    }
    const buyIn = parseInt(buyInStr, 10);
    if (isNaN(buyIn)) {
      return { error: 'Buy-in must be a number.' };
    }
    if (buyIn < table.config.minBuyIn || buyIn > table.config.maxBuyIn) {
      return { error: `Buy-in must be between ${table.config.minBuyIn} and ${table.config.maxBuyIn}.` };
    }

    // Find empty seat
    const emptySeatIdx = table.seats.findIndex(s => s === null);
    if (emptySeatIdx === -1) {
      return { error: 'Table is full!' };
    }

    // Create or get player profile
    const playerRepo = new PlayerRepository(db);
    const profile = await playerRepo.findOrCreate(
      command.senderWaId,
      command.senderName,
      config.defaultStartingChips,
    );

    // Check balance
    if (profile.chipBalance < buyIn) {
      return { error: `Not enough chips. You have ${profile.chipBalance} but need ${buyIn}.` };
    }

    // Deduct buy-in from balance
    await playerRepo.updateBalance(profile.id, profile.chipBalance - buyIn);

    // Seat the player
    const seatPlayer = createSeatPlayer(profile, emptySeatIdx, buyIn);
    table.seats[emptySeatIdx] = seatPlayer;

    return {
      groupMessage: templates.playerJoinedMessage(seatPlayer, table),
    };
  });
}
