import type { CommandRegistry } from '../command-registry.js';
import { GameRepository } from '../../db/repositories/game-repo.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { clearTurnTimer } from './turn-timer-helper.js';
import { logger } from '../../utils/logger.js';

export function registerRimCommand(registry: CommandRegistry): void {
  registry.register('rim', (command) => {
    const rimManager = registry.getRimManager();
    if (!rimManager) {
      return { error: 'RIM voting is not available.' };
    }

    // Extract the run count from the raw command text (e.g. "!1" → 1, "!2" → 2, "!3" → 3)
    const match = command.rawText.trim().match(/^!([123])$/i);
    if (!match) {
      return { error: 'Reply *!1*, *!2*, or *!3*.' };
    }
    const runs = parseInt(match[1], 10);

    const result = rimManager.castVote(command.groupId, command.senderWaId, runs);

    if (result.resolved) {
      // Vote complete — execute the runout
      const tm = registry.getTableManager();
      const round = tm.getGameRound(command.groupId);
      const table = tm.getTable(command.groupId);

      if (!round || !table) {
        return { error: 'No active game found.' };
      }

      const messages = round.executeRimRunout(result.resolved);

      // Clear any turn timer (hand is ending)
      clearTurnTimer(registry, command.groupId);

      // Record hand in DB (same pattern as bet-actions.ts post-hand)
      try {
        const db = registry.getDB();
        const handResult = round.getHandResult();
        if (handResult) {
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

          const handId = gameRepo.recordHand(
            table.gameId,
            handResult.handNumber,
            table.dealerSeatIndex,
            handResult.communityCards,
            potTotal,
            winners,
          );

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

            if (seat) {
              seat.sessionHandsPlayed++;
              if (pr.chipsAfter > pr.chipsBefore) {
                seat.sessionHandsWon++;
              }
            }
          }
        }
      } catch (err) {
        logger.error({ err }, 'Failed to record hand history after RIM');
      }

      return { groupMessage: [result.message, ...messages] };
    }

    // Vote acknowledged but not yet resolved
    return { groupMessage: result.message };
  });
}
