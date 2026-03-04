import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { logger } from '../../utils/logger.js';

export function registerFeedbackCommand(registry: CommandRegistry): void {
  registry.register('feedback', (command: ParsedCommand): CommandResult => {
    const text = command.args.join(' ');
    if (!text) {
      return { error: 'Usage: !feedback <your message>' };
    }

    logger.info(
      { sender: command.senderName, waId: command.senderWaId, groupId: command.groupId, feedback: text },
      'FEEDBACK',
    );

    return {
      groupMessage: `\u2660\uFE0F The House has received your tribute, *${command.senderName}*. Feedback noted. The House rewards loyalty.`,
    };
  });
}
