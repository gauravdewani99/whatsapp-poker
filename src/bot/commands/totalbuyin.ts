import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import type { SeatPlayer } from '../../models/player.js';
import { formatChips } from '../../messages/formatter.js';

export function registerTotalbuyinCommand(registry: CommandRegistry): void {
  registry.register('buyins', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table. Use !poker start to create one.' };
    }

    const players = table.seats
      .filter((s): s is SeatPlayer => s !== null)
      .map(s => ({
        name: s.displayName,
        buyIn: s.buyInAmount,
        stack: s.chipStack,
        pnl: s.chipStack - s.buyInAmount,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    if (players.length === 0) {
      return { error: 'No players at the table.' };
    }

    const lines = players.map(p => {
      const sign = p.pnl >= 0 ? '+' : '';
      return `\u2022 *${p.name}*: Buy-in: ${formatChips(p.buyIn)} | Stack: ${formatChips(p.stack)} | P&L: ${sign}${formatChips(p.pnl)}`;
    });

    return {
      groupMessage: [
        '\uD83D\uDCB0 *Buy-In Report*',
        '',
        ...lines,
      ].join('\n'),
    };
  });
}
