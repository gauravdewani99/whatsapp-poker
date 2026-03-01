import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import * as templates from '../../messages/templates.js';

export function registerHelpCommand(registry: CommandRegistry): void {
  registry.register('help', (_command: ParsedCommand): CommandResult => {
    return { groupMessage: templates.helpMessage() };
  });
}
