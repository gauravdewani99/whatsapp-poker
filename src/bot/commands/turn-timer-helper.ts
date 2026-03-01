import type { CommandRegistry } from '../command-registry.js';
import { config } from '../../config.js';
import type { SeatPlayer } from '../../models/player.js';

/**
 * Start the turn timer for the current player at the table.
 * On timeout: auto-folds the player and sends a message to the group.
 */
export function startTurnTimer(registry: CommandRegistry, groupId: string): void {
  const turnTimer = registry.getTurnTimer();
  const botManager = registry.getBotManager();
  const tm = registry.getTableManager();
  if (!turnTimer || !botManager) return;

  const table = tm.getTable(groupId);
  if (!table || table.phase === 'waiting' || table.phase === 'showdown') return;

  const currentPlayer = table.seats[table.currentPlayerSeatIndex];
  if (!currentPlayer) return;

  const timeoutMs = config.turnTimeoutSeconds * 1000;
  const playerName = currentPlayer.displayName;

  turnTimer.startTimer(
    groupId,
    timeoutMs,
    // Warning callback (15s before timeout)
    async () => {
      await botManager.sendGroupMessage(
        groupId,
        `\u23F0 *${playerName}*, you have 15 seconds to act or you'll be auto-folded!`,
      );
    },
    // Timeout callback
    async () => {
      const round = tm.getGameRound(groupId);
      if (!round) return;

      const freshTable = tm.getTable(groupId);
      if (!freshTable) return;

      const timedOutPlayer = freshTable.seats[freshTable.currentPlayerSeatIndex];
      if (!timedOutPlayer || timedOutPlayer.displayName !== playerName) return;

      // Auto-fold
      const result = round.processAction(timedOutPlayer.waId, 'fold');

      let message = `\u23F0 *${playerName}* timed out and was auto-folded.`;
      if (result.groupMessage) {
        message += '\n\n' + result.groupMessage;
      }
      await botManager.sendGroupMessage(groupId, message);

      // If game is still in progress, start timer for next player
      const updatedTable = tm.getTable(groupId);
      if (updatedTable && updatedTable.phase !== 'waiting' && updatedTable.phase !== 'showdown') {
        startTurnTimer(registry, groupId);
      }
    },
  );
}

/**
 * Clear the turn timer for a group (e.g., when game ends or table is stopped).
 */
export function clearTurnTimer(registry: CommandRegistry, groupId: string): void {
  const turnTimer = registry.getTurnTimer();
  if (turnTimer) {
    turnTimer.clearTimer(groupId);
  }
}
