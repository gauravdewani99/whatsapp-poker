import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { GroupStatsRepository } from '../../db/repositories/group-stats-repo.js';
import { formatChips } from '../../messages/formatter.js';

export function registerGroupstatsCommand(registry: CommandRegistry): void {
  registry.register('groupstats', (command: ParsedCommand): CommandResult => {
    const db = registry.getDB();
    const groupStatsRepo = new GroupStatsRepository(db);
    const stats = groupStatsRepo.getGroupStats(command.groupId);

    if (stats.length === 0) {
      return { error: 'No stats recorded yet. Play some sessions first!' };
    }

    const lines = stats
      .sort((a, b) => (b.totalCashOut - b.totalBuyIn) - (a.totalCashOut - a.totalBuyIn))
      .map((s, i) => {
        const pnl = s.totalCashOut - s.totalBuyIn;
        const sign = pnl >= 0 ? '+' : '';
        const medal = i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : `${i + 1}.`;
        return `${medal} *${s.displayName}*: ${sign}${formatChips(pnl)}`;
      });

    return {
      groupMessage: [
        '\uD83D\uDCCA *All-Time Group Stats*',
        '',
        ...lines,
      ].join('\n'),
    };
  });
}
