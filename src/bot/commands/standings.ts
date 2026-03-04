import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import type { SeatPlayer } from '../../models/player.js';
import { formatChips } from '../../messages/formatter.js';

export function registerStacksCommand(registry: CommandRegistry): void {
  registry.register('stacks', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table. Use !poker start to create one.' };
    }

    const players = table.seats
      .filter((s): s is SeatPlayer => s !== null)
      .map(s => ({
        name: s.displayName,
        stack: s.chipStack,
        buyIn: s.buyInAmount,
        profit: s.chipStack - s.buyInAmount,
      }))
      .sort((a, b) => b.profit - a.profit);

    if (players.length === 0) {
      return { error: 'No players at the table.' };
    }

    const lines = players.map((p, i) => {
      const sign = p.profit >= 0 ? '+' : '';
      const medal = i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : `${i + 1}.`;
      return `${medal} *${p.name}*: ${formatChips(p.stack)} (${sign}${formatChips(p.profit)})`;
    });

    const parts = [
      '\uD83C\uDFC6 *Stacks*',
      '',
      ...lines,
    ];

    // Show players who left mid-session
    if (table.leftPlayers && table.leftPlayers.length > 0) {
      parts.push('', '_Left:_');
      for (const lp of table.leftPlayers) {
        const profit = lp.cashOut - lp.buyInAmount;
        const sign = profit >= 0 ? '+' : '';
        parts.push(`_• ${lp.displayName}: cashed out ${formatChips(lp.cashOut)} (${sign}${formatChips(profit)})_`);
      }
    }

    return {
      groupMessage: parts.join('\n'),
    };
  });
}
