import type { CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';

export function registerRulesCommand(registry: CommandRegistry): void {
  registry.register('rules', (): CommandResult => {
    return {
      groupMessage: [
        '\uD83C\uDFB4 *Texas Hold\'em Quick Rules*',
        '',
        '*Hand Rankings (best to worst):*',
        '1. Royal Flush \u2014 A K Q J 10 (same suit)',
        '2. Straight Flush \u2014 5 consecutive (same suit)',
        '3. Four of a Kind \u2014 4 same rank',
        '4. Full House \u2014 3 of a kind + pair',
        '5. Flush \u2014 5 same suit',
        '6. Straight \u2014 5 consecutive',
        '7. Three of a Kind \u2014 3 same rank',
        '8. Two Pair \u2014 2 different pairs',
        '9. One Pair \u2014 2 same rank',
        '10. High Card \u2014 nothing above',
        '',
        '*How to play:*',
        '\u2022 Each player gets 2 hole cards (private)',
        '\u2022 5 community cards dealt: Flop (3), Turn (1), River (1)',
        '\u2022 Make the best 5-card hand using any combination',
        '\u2022 Bet, check, call, raise, fold, or go all-in each round',
        '\u2022 Last player standing or best hand at showdown wins',
      ].join('\n'),
    };
  });
}
