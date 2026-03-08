import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import type { BettingAction } from '../../models/game.js';
import type { SeatPlayer } from '../../models/player.js';
import { GameRepository } from '../../db/repositories/game-repo.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { startTurnTimer, clearTurnTimer } from './turn-timer-helper.js';
import { logger } from '../../utils/logger.js';

export function registerBetActions(registry: CommandRegistry): void {
  const handleBetAction = async (command: ParsedCommand, action: BettingAction): Promise<CommandResult> => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const round = tm.getGameRound(command.groupId);

    if (!round) {
      return { error: 'No active game. Use !poker start to create one.' };
    }

    let amount: number | undefined;
    if (action === 'raise' && command.args[0]) {
      amount = parseInt(command.args[0], 10);
      if (isNaN(amount)) {
        return { error: 'Raise amount must be a number. Usage: !raise <amount>' };
      }
    }

    const result = round.processAction(command.senderWaId, action, amount);

    // If the action was an error (not your turn, invalid action), don't touch timer
    if (result.error) return result;

    // Check if hand ended (showdown or uncontested win)
    const table = tm.getTable(command.groupId);
    if (!table || table.phase === 'showdown' || table.phase === 'waiting') {
      clearTurnTimer(registry, command.groupId);

      // Record hand in DB
      if (table) {
        try {
          const handResult = round.getHandResult();
          if (handResult) {
            const gameRepo = new GameRepository(db);
            const playerRepo = new PlayerRepository(db);

            // Determine winners from chip changes
            const winners = handResult.playerResults
              .filter(p => p.chipsAfter > p.chipsBefore)
              .map(p => {
                const seat = table.seats.find(s => s?.profileId === p.playerId);
                return {
                  playerId: p.playerId,
                  displayName: seat?.displayName || 'Unknown',
                  amount: p.chipsAfter - p.chipsBefore,
                  hand: p.finalAction === 'win_uncontested' ? 'Uncontested' : 'Showdown',
                };
              });

            const potTotal = winners.reduce((sum, w) => sum + w.amount, 0);

            const handId = await gameRepo.recordHand(
              table.gameId,
              handResult.handNumber,
              table.dealerSeatIndex,
              handResult.communityCards,
              potTotal,
              winners,
            );

            // Record each player's result
            for (const pr of handResult.playerResults) {
              const seat = table.seats.find(s => s?.profileId === pr.playerId);
              await gameRepo.recordHandPlayer(
                handId,
                pr.playerId,
                seat?.seatIndex ?? 0,
                pr.holeCards,
                pr.chipsBefore,
                pr.chipsAfter,
                pr.finalAction,
              );
              await playerRepo.recordHandPlayed(pr.playerId, pr.chipsAfter > pr.chipsBefore);

              // Track session-level stats for group stats
              if (seat) {
                seat.sessionHandsPlayed++;
                if (pr.chipsAfter > pr.chipsBefore) {
                  seat.sessionHandsWon++;
                }
              }
            }
          }
        } catch (err) {
          logger.error({ err }, 'Failed to record hand history');
        }
      }
    } else if (table?.rimState) {
      // RIM state entered — start the vote, clear turn timer
      clearTurnTimer(registry, command.groupId);

      const rimManager = registry.getRimManager();
      if (rimManager) {
        const eligibleVoters = table.seats
          .filter((s): s is SeatPlayer => s !== null && s.isActive)
          .map(s => s.waId);

        const botManager = registry.getBotManager();

        rimManager.startVote(command.groupId, eligibleVoters, async (runs) => {
          // Timeout callback — execute runout and send messages
          try {
            const round = tm.getGameRound(command.groupId);
            const tbl = tm.getTable(command.groupId);
            if (!round || !tbl) return;

            const messages = round.executeRimRunout(runs);

            // Record hand in DB
            await recordHandInDb(db, round, tbl);

            // Send each message to the group
            if (botManager) {
              for (const msg of messages) {
                await botManager.sendGroupMessage(command.groupId, msg);
              }
            }
          } catch (err) {
            logger.error({ err }, 'Failed to execute RIM runout on timeout');
          }
        });
      }
    } else {
      // Hand still in progress — start timer for next player
      startTurnTimer(registry, command.groupId);
    }

    return result;
  };

  registry.register('fold', (cmd) => handleBetAction(cmd, 'fold'));
  registry.register('check', (cmd) => handleBetAction(cmd, 'check'));
  registry.register('call', (cmd) => handleBetAction(cmd, 'call'));
  registry.register('raise', (cmd) => handleBetAction(cmd, 'raise'));
  registry.register('all-in', (cmd) => handleBetAction(cmd, 'all_in'));
}

/** Shared helper to record hand results in the DB. Used by both bet-actions and rim timeout. */
async function recordHandInDb(db: import('../../db/connection.js').DB, round: import('../../engine/game-round.js').GameRound, table: import('../../models/table.js').TableState): Promise<void> {
  try {
    const handResult = round.getHandResult();
    if (!handResult) return;

    const gameRepo = new GameRepository(db);
    const playerRepo = new PlayerRepository(db);

    const winners = handResult.playerResults
      .filter(p => p.chipsAfter > p.chipsBefore)
      .map(p => {
        const seat = table.seats.find(s => s?.profileId === p.playerId);
        return {
          playerId: p.playerId,
          displayName: seat?.displayName || 'Unknown',
          amount: p.chipsAfter - p.chipsBefore,
          hand: 'Showdown',
        };
      });

    const potTotal = winners.reduce((sum, w) => sum + w.amount, 0);

    const handId = await gameRepo.recordHand(
      table.gameId,
      handResult.handNumber,
      table.dealerSeatIndex,
      handResult.communityCards,
      potTotal,
      winners,
    );

    for (const pr of handResult.playerResults) {
      const seat = table.seats.find(s => s?.profileId === pr.playerId);
      await gameRepo.recordHandPlayer(
        handId,
        pr.playerId,
        seat?.seatIndex ?? 0,
        pr.holeCards,
        pr.chipsBefore,
        pr.chipsAfter,
        pr.finalAction,
      );
      await playerRepo.recordHandPlayed(pr.playerId, pr.chipsAfter > pr.chipsBefore);

      if (seat) {
        seat.sessionHandsPlayed++;
        if (pr.chipsAfter > pr.chipsBefore) {
          seat.sessionHandsWon++;
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to record hand history');
  }
}
