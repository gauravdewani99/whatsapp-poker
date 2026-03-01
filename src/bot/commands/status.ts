import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import * as templates from '../../messages/templates.js';

export function registerStatusCommand(registry: CommandRegistry): void {
  registry.register('status', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const table = tm.getTable(command.groupId);

    if (!table) {
      return { error: 'No active table in this group.' };
    }

    return { groupMessage: templates.statusMessage(table) };
  });
}
