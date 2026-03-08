import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { GameRepository } from '../../db/repositories/game-repo.js';
import * as templates from '../../messages/templates.js';

export function registerHistoryCommand(registry: CommandRegistry): void {
  registry.register('history', async (command: ParsedCommand): Promise<CommandResult> => {
    const tm = registry.getTableManager();
    const db = registry.getDB();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    const gameRepo = new GameRepository(db);
    const recentHands = await gameRepo.getRecentHands(table.gameId, 5);

    return {
      groupMessage: templates.historyMessage(recentHands),
    };
  });
}
