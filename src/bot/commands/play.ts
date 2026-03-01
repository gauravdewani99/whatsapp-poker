import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import type { GroupActivationManager } from '../../state/group-activation.js';

export function registerPlayCommand(registry: CommandRegistry, activationManager: GroupActivationManager): void {
  registry.register('play', (command: ParsedCommand): CommandResult => {
    const isNew = activationManager.activate(command.groupId);

    if (isNew) {
      return {
        groupMessage: [
          '\u2660\uFE0F *POKER BOT ACTIVATED* \u2660\uFE0F',
          '',
          'The poker bot is now active in this group!',
          '',
          'Type *!poker start <sb>/<bb>* to open a table.',
          'Type *!help* for all commands.',
        ].join('\n'),
      };
    }

    return {
      groupMessage: 'The poker bot is already active in this group. Type *!help* for commands.',
    };
  });
}
