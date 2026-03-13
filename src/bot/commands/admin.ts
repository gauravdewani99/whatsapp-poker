import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { GameRepository } from '../../db/repositories/game-repo.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { GroupStatsRepository } from '../../db/repositories/group-stats-repo.js';
import type { SeatPlayer } from '../../models/player.js';
import type { TableState } from '../../models/table.js';
import type { DB } from '../../db/connection.js';
import { formatChips } from '../../messages/formatter.js';
import { clearTurnTimer } from './turn-timer-helper.js';
import { getActivePlayers, onlyOnePlayerActive, advanceToNextPlayer } from '../../engine/betting-round.js';
import { logger } from '../../utils/logger.js';

/** Shared kick execution: fold, return chips, track in leftPlayers, null seat, handle mid-hand resolution. */
async function executeKick(
  table: TableState,
  seatIdx: number,
  seat: SeatPlayer,
  db: DB,
): Promise<string | null> {
  const handInProgress = table.phase !== 'waiting' && table.phase !== 'showdown';

  // If hand is active, auto-fold the kicked player
  if (handInProgress && seat.isActive) {
    seat.isActive = false;
  }

  // Return chips to balance
  const playerRepo = new PlayerRepository(db);
  const profile = await playerRepo.findByWaId(seat.waId);
  if (profile) {
    await playerRepo.updateBalance(profile.id, profile.chipBalance + seat.chipStack);
  }

  // Track in leftPlayers for session stats
  table.leftPlayers.push({
    displayName: seat.displayName,
    waId: seat.waId,
    buyInAmount: seat.buyInAmount,
    cashOut: seat.chipStack,
    handsPlayed: seat.sessionHandsPlayed,
    handsWon: seat.sessionHandsWon,
  });

  // Was this the current action player?
  const wasCurrentPlayer = table.currentPlayerSeatIndex === seatIdx;

  // Remove from seat
  table.seats[seatIdx] = null;

  // Handle mid-hand consequences
  if (handInProgress) {
    if (onlyOnePlayerActive(table)) {
      // Only one player left — award pot and end hand
      const winner = getActivePlayers(table)[0];
      if (winner) {
        // Sum all current bets + any existing pot
        let totalPot = 0;
        for (const s of table.seats) {
          if (s) totalPot += s.currentBet;
        }
        totalPot += table.potState.pots.reduce((sum, p) => sum + p.amount, 0);
        // Add the kicked player's bet that was already collected
        winner.chipStack += totalPot;

        // Reset bets
        for (const s of table.seats) {
          if (s) s.currentBet = 0;
        }

        table.phase = 'showdown';
        return `\n\n🏆 *${winner.displayName}* wins *${formatChips(totalPot)}* (uncontested)`;
      }
    } else if (wasCurrentPlayer) {
      // Advance to the next player since the current one was kicked
      advanceToNextPlayer(table);
      const nextPlayer = table.seats[table.currentPlayerSeatIndex];
      if (nextPlayer) {
        return `\nAction on: *${nextPlayer.displayName}*`;
      }
    }
  }

  return null;
}

export function registerAdminCommands(registry: CommandRegistry): void {
  // !poker stop - end the session
  registry.register('stop', async (command: ParsedCommand): Promise<CommandResult> => {
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
      const profile = await playerRepo.findByWaId(seat.waId);
      if (profile) {
        await playerRepo.updateBalance(profile.id, profile.chipBalance + seat.chipStack);
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
          handsPlayed: lp.handsPlayed,
          handsWon: lp.handsWon,
        })),
      ];
      await groupStatsRepo.recordSessionEnd(command.groupId, allSessionPlayers);
    } catch (err) {
      logger.error({ err, groupId: command.groupId }, 'Failed to record group stats');
    }

    // End game in DB
    const gameRepo = new GameRepository(db);
    await gameRepo.endGame(table.gameId);

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
  registry.register('kick', async (command: ParsedCommand): Promise<CommandResult> => {
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
            const extra = await executeKick(table, seatIdx, seat, db);
            let msg = `\u2705 Vote passed! *${seat.displayName}* has been removed from the table. Chips returned: ${formatChips(seat.chipStack)}.`;
            if (extra) msg += extra;
            return { groupMessage: msg };
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
      const extra = await executeKick(table, seatIdx, targetSeat, db);
      let msg = `\u26D4 *${targetSeat.displayName}* has been removed by ${command.senderName}. Chips returned: ${formatChips(targetSeat.chipStack)}.`;
      if (extra) msg += extra;
      return { groupMessage: msg };
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
      const extra = await executeKick(table, seatIdx, targetSeat, db);
      let msg = `\u2705 *${targetSeat.displayName}* has been removed from the table. Chips returned: ${formatChips(targetSeat.chipStack)}.`;
      if (extra) msg += extra;
      return { groupMessage: msg };
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
