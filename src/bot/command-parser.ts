import type { ParsedCommand, CommandName } from '../models/command.js';

const COMMAND_ALIASES: Record<string, CommandName> = {
  '!poker start': 'start',
  '!poker join': 'join',
  '!poker leave': 'leave',
  '!poker deal': 'deal',
  '!poker stop': 'stop',
  '!poker kick': 'kick',
  '!poker buyins': 'buyins',
  '!poker groupstats': 'groupstats',
  '!fold': 'fold',    '!f': 'fold',
  '!check': 'check',  '!x': 'check',
  '!call': 'call',    '!c': 'call',
  '!raise': 'raise',  '!r': 'raise',
  '!all-in': 'all-in', '!allin': 'all-in', '!a': 'all-in',
  '!status': 'status', '!s': 'status',
  '!cashout': 'cashout',
  '!help': 'help',
  '!history': 'history',
  '!rebuy': 'rebuy',
  '!stats': 'stats',
  '!rules': 'rules',
  '!stacks': 'stacks', '!standings': 'stacks', '!leaderboard': 'stacks', '!lb': 'stacks',
  '!buyins': 'buyins', '!b': 'buyins',
  '!groupstats': 'groupstats',
  '!kick': 'kick',
  '!sitout': 'sitout',
  '!sitin': 'sitin',
  '!feedback': 'feedback',
  '!ragebait': 'ragebait', '!rbh': 'ragebait',
  '!needle': 'needle',
  '!tight': 'tight',
  '!fish': 'fish',
  '!shame': 'shame',
  '!show': 'show',
  '!gg': 'gg',
  '!1': 'rim', '!2': 'rim', '!3': 'rim',
};

// Sort by length descending so longer prefixes match first
const SORTED_PREFIXES = Object.keys(COMMAND_ALIASES)
  .sort((a, b) => b.length - a.length);

export function parseCommand(
  messageBody: string,
  senderWaId: string,
  senderName: string,
  groupId: string,
): ParsedCommand | null {
  const trimmed = messageBody.trim().toLowerCase();

  for (const prefix of SORTED_PREFIXES) {
    if (trimmed === prefix || trimmed.startsWith(prefix + ' ')) {
      const argsString = trimmed.slice(prefix.length).trim();
      const args = argsString ? argsString.split(/\s+/) : [];
      return {
        name: COMMAND_ALIASES[prefix],
        args,
        rawText: messageBody,
        senderWaId,
        senderName,
        groupId,
        timestamp: Date.now(),
      };
    }
  }

  return null;
}
