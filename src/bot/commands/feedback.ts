import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { FeedbackRepository } from '../../db/repositories/feedback-repo.js';
import { logger } from '../../utils/logger.js';

export function registerFeedbackCommand(registry: CommandRegistry): void {
  registry.register('feedback', async (command: ParsedCommand): Promise<CommandResult> => {
    const text = command.args.join(' ');
    if (!text) {
      return { error: 'Usage: !feedback <your message>' };
    }

    logger.info(
      { sender: command.senderName, waId: command.senderWaId, groupId: command.groupId, feedback: text },
      'FEEDBACK',
    );

    const db = registry.getDB();
    const feedbackRepo = new FeedbackRepository(db);
    await feedbackRepo.insert(command.senderWaId, command.senderName, command.groupId, text);

    return {
      groupMessage: `\u2660\uFE0F The House hears you, *${command.senderName}*. Feedback noted. The House rewards loyalty.`,
    };
  });
}
