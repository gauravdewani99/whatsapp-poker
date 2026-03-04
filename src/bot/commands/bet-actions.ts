import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import type { BettingAction } from '../../models/game.js';
import { GameRepository } from '../../db/repositories/game-repo.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { startTurnTimer, clearTurnTimer } from './turn-timer-helper.js';
import { logger } from '../../utils/logger.js';

export function registerBetActions(registry: CommandRegistry): void {
  const handleBetAction = (command: ParsedCommand, action: BettingAction): CommandResult => {
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

            const handId = gameRepo.recordHand(
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
              gameRepo.recordHandPlayer(
                handId,
                pr.playerId,
                seat?.seatIndex ?? 0,
                pr.holeCards,
                pr.chipsBefore,
                pr.chipsAfter,
                pr.finalAction,
              );
              playerRepo.recordHandPlayed(pr.playerId, pr.chipsAfter > pr.chipsBefore);

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
