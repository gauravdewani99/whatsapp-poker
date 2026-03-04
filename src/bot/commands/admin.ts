import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { GameRepository } from '../../db/repositories/game-repo.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { GroupStatsRepository } from '../../db/repositories/group-stats-repo.js';
import type { SeatPlayer } from '../../models/player.js';
import { formatChips } from '../../messages/formatter.js';
import { clearTurnTimer } from './turn-timer-helper.js';
import { logger } from '../../utils/logger.js';

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
    const seatedPlayers: SeatPlayer[] = [];
    for (const seat of table.seats) {
      if (!seat) continue;
      seatedPlayers.push(seat);
      const profile = playerRepo.findByWaId(seat.waId);
      if (profile) {
        playerRepo.updateBalance(profile.id, profile.chipBalance + seat.chipStack);
      }
    }

    // Record persistent group stats (seated + left players)
    try {
      const groupStatsRepo = new GroupStatsRepository(db);
      const allSessionPlayers = [
        ...seatedPlayers.map(seat => ({
          waId: seat.waId,
          displayName: seat.displayName,
          buyIn: seat.buyInAmount,
          cashOut: seat.chipStack,
          handsPlayed: seat.sessionHandsPlayed,
          handsWon: seat.sessionHandsWon,
        })),
        ...table.leftPlayers.map(lp => ({
          waId: lp.waId,
          displayName: lp.displayName,
          buyIn: lp.buyInAmount,
          cashOut: lp.cashOut,
          handsPlayed: 0,
          handsWon: 0,
        })),
      ];
      groupStatsRepo.recordSessionEnd(command.groupId, allSessionPlayers);
    } catch (err) {
      logger.error({ err, groupId: command.groupId }, 'Failed to record group stats');
    }

    // End game in DB
    const gameRepo = new GameRepository(db);
    gameRepo.endGame(table.gameId);

    // Clear turn timer, idle timer, and remove table
    clearTurnTimer(registry, command.groupId);
    const idleTimer = registry.getIdleTimer();
    if (idleTimer) {
      idleTimer.clearTimer(command.groupId);
    }
    tm.removeTable(command.groupId);

    return {
      groupMessage: `\uD83D\uDED1 *Table closed by ${command.senderName}*. All chips have been returned.`,
    };
  });

  // !poker kick — consensus-based voting
  registry.register('kick', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    const args = command.args.join(' ').trim();

    // Handle vote responses: !kick yes / !kick no
    const kickVoteManager = registry.getKickVoteManager();
    if (kickVoteManager) {
      const lowerArgs = args.toLowerCase();
      if (lowerArgs === 'yes' || lowerArgs === 'no') {
        const approve = lowerArgs === 'yes';
        const voteResult = kickVoteManager.castVote(command.groupId, command.senderWaId, approve);
        if (voteResult.error) {
          return { error: voteResult.error };
        }
        if (voteResult.completed && voteResult.approved) {
          // Execute the kick
          const vote = kickVoteManager.getActiveVote(command.groupId);
          const targetWaId = voteResult.targetWaId!;
          const seatIdx = table.seats.findIndex(s => s?.waId === targetWaId);
          if (seatIdx !== -1) {
            const seat = table.seats[seatIdx] as SeatPlayer;
            const playerRepo = new PlayerRepository(db);
            const profile = playerRepo.findByWaId(seat.waId);
            if (profile) {
              playerRepo.updateBalance(profile.id, profile.chipBalance + seat.chipStack);
            }
            table.seats[seatIdx] = null;
            return {
              groupMessage: `\u2705 Vote passed! *${seat.displayName}* has been removed from the table. Chips returned: ${formatChips(seat.chipStack)}.`,
            };
          }
        }
        if (voteResult.completed && !voteResult.approved) {
          return {
            groupMessage: `\u274C Vote to kick *${voteResult.targetName}* has been rejected.`,
          };
        }
        // Vote recorded but not yet complete
        return {
          groupMessage: `\u2705 *${command.senderName}* voted ${approve ? 'yes' : 'no'}. ${voteResult.remainingVoters} vote(s) remaining.`,
        };
      }
    }

    // Start a new kick vote: !kick <player_name>
    const targetName = args.replace('@', '').trim();
    if (!targetName) {
      return { error: 'Usage: !poker kick <player_name> or !kick yes/no' };
    }

    const seatIdx = table.seats.findIndex(
      s => s?.displayName.toLowerCase() === targetName.toLowerCase(),
    );

    if (seatIdx === -1) {
      return { error: `Player "${targetName}" not found at this table.` };
    }

    const targetSeat = table.seats[seatIdx] as SeatPlayer;

    if (targetSeat.waId === command.senderWaId) {
      return { error: "You can't kick yourself. Use !poker leave instead." };
    }

    if (!kickVoteManager) {
      // Fallback: creator-only kick if no vote manager
      if (table.creatorWaId !== command.senderWaId) {
        return { error: 'Only the table creator can kick players.' };
      }
      const playerRepo = new PlayerRepository(db);
      const profile = playerRepo.findByWaId(targetSeat.waId);
      if (profile) {
        playerRepo.updateBalance(profile.id, profile.chipBalance + targetSeat.chipStack);
      }
      table.seats[seatIdx] = null;
      return {
        groupMessage: `\u26D4 *${targetSeat.displayName}* has been removed by ${command.senderName}. Chips returned: ${formatChips(targetSeat.chipStack)}.`,
      };
    }

    // Get all active players except the target for voting
    const activePlayers = table.seats
      .filter((s): s is SeatPlayer => s !== null && s.waId !== targetSeat.waId)
      .map(s => s.waId);

    if (activePlayers.length === 0) {
      return { error: "Can't start a kick vote with no other players." };
    }

    const voteResult = kickVoteManager.startVote(
      command.groupId,
      targetSeat.waId,
      targetSeat.displayName,
      command.senderWaId,
      activePlayers,
    );

    if (voteResult.error) {
      return { error: voteResult.error };
    }

    // Check if it was auto-completed (e.g. only 1 voter = initiator)
    if (voteResult.completed && voteResult.approved) {
      const playerRepo = new PlayerRepository(db);
      const profile = playerRepo.findByWaId(targetSeat.waId);
      if (profile) {
        playerRepo.updateBalance(profile.id, profile.chipBalance + targetSeat.chipStack);
      }
      table.seats[seatIdx] = null;
      return {
        groupMessage: `\u2705 *${targetSeat.displayName}* has been removed from the table. Chips returned: ${formatChips(targetSeat.chipStack)}.`,
      };
    }

    return {
      groupMessage: [
        `\uD83D\uDDF3\uFE0F *Kick Vote Started*`,
        '',
        `${command.senderName} wants to kick *${targetSeat.displayName}*.`,
        `All players must vote: type *!kick yes* or *!kick no*`,
        `Vote expires in 60 seconds.`,
        '',
        `${voteResult.remainingVoters} vote(s) needed.`,
      ].join('\n'),
    };
  });
}
