import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { formatChips } from '../../messages/formatter.js';

export function registerStatsCommand(registry: CommandRegistry): void {
  registry.register('stats', async (command: ParsedCommand): Promise<CommandResult> => {
    const db = registry.getDB();
    const playerRepo = new PlayerRepository(db);
    const profile = await playerRepo.findByWaId(command.senderWaId);

    if (!profile) {
      return { error: 'No stats found. Play some hands first!' };
    }

    const winRate = profile.handsPlayed > 0
      ? ((profile.handsWon / profile.handsPlayed) * 100).toFixed(1)
      : '0.0';

    const netProfit = profile.totalCashOut - profile.totalBuyIn;
    const profitSign = netProfit >= 0 ? '+' : '';

    return {
      groupMessage: [
        `\uD83D\uDCCA *Stats for ${command.senderName}*`,
        '',
        `Hands played: *${profile.handsPlayed}*`,
        `Hands won: *${profile.handsWon}*`,
        `Win rate: *${winRate}%*`,
        '',
        `Total buy-in: ${formatChips(profile.totalBuyIn)}`,
        `Total cash-out: ${formatChips(profile.totalCashOut)}`,
        `Net: *${profitSign}${formatChips(netProfit)}*`,
      ].join('\n'),
    };
  });
}
