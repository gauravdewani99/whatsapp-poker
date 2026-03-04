import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import type { SeatPlayer } from '../../models/player.js';
import * as templates from '../../messages/templates.js';

export function registerLeaveCommand(registry: CommandRegistry): void {
  registry.register('leave', (command: ParsedCommand): CommandResult => {
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

    // If a hand is in progress and player is active, auto-fold them
    if (table.phase !== 'waiting' && table.phase !== 'showdown' && seat.isActive) {
      seat.isActive = false;
    }

    // Return chips to balance
    const playerRepo = new PlayerRepository(db);
    const profile = playerRepo.findByWaId(command.senderWaId);
    if (profile) {
      playerRepo.updateBalance(profile.id, profile.chipBalance + seat.chipStack);
    }

    // Track left player for session stats & stacks display
    table.leftPlayers.push({
      displayName: seat.displayName,
      waId: seat.waId,
      buyInAmount: seat.buyInAmount,
      cashOut: seat.chipStack,
    });

    // Remove from seat
    table.seats[seatIdx] = null;

    return {
      groupMessage: templates.playerLeftMessage(seat.displayName),
    };
  });
}
