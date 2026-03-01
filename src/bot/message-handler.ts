import type pkg from 'whatsapp-web.js';
import { parseCommand } from './command-parser.js';
import type { CommandRegistry } from './command-registry.js';
import type { GroupActivationManager } from '../state/group-activation.js';
import { logger } from '../utils/logger.js';
import { MESSAGE_DELAY_MS } from '../utils/constants.js';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Commands that work even before !play activates the group */
const UNGATED_COMMANDS = new Set(['play', 'help']);

export function registerMessageHandler(
  client: pkg.Client,
  registry: CommandRegistry,
  activationManager: GroupActivationManager,
): void {
  // Use message_create to capture ALL messages including our own
  client.on('message_create', async (msg: pkg.Message) => {
    // Debug: log every single event so we can confirm they're firing
    if (msg.body?.startsWith('!')) {
      logger.debug({ from: msg.from, to: msg.to, body: msg.body?.slice(0, 50), fromMe: msg.fromMe, author: msg.author }, 'Raw command event');
    }

    // For our own messages in groups: from = our ID, to = group ID
    // For others' messages in groups: from = group ID, author = sender ID
    const isGroup = msg.from.endsWith('@g.us') || msg.to?.endsWith('@g.us');
    if (!isGroup) return;

    // Quick check: ignore non-command messages
    if (!msg.body.startsWith('!')) return;

    const groupId = msg.from.endsWith('@g.us') ? msg.from : msg.to;

    // Defensive check: ensure we actually resolved a valid group ID
    if (!groupId || !groupId.endsWith('@g.us')) {
      logger.warn({ from: msg.from, to: msg.to, body: msg.body }, 'Could not determine group ID');
      return;
    }

    logger.debug({ body: msg.body, from: msg.from, to: msg.to, author: msg.author, fromMe: msg.fromMe, groupId }, 'Message detected');

    const senderWaId = msg.fromMe ? msg.from : (msg.author || msg.from);
    let senderName = 'Unknown';
    try {
      const contact = await msg.getContact();
      senderName = contact.pushname || contact.name || 'Unknown';
    } catch {
      // Use default name
    }

    const command = parseCommand(msg.body, senderWaId, senderName, groupId);
    if (!command) return;

    logger.info({ command: command.name, sender: senderName, group: groupId }, 'Command received');

    // Gate: only !play and !help work before the group is activated
    if (!UNGATED_COMMANDS.has(command.name) && !activationManager.isActive(groupId)) {
      await msg.reply('Type *!play* first to activate the poker bot in this group.');
      return;
    }

    try {
      const result = await registry.execute(command);

      logger.debug({
        command: command.name,
        hasGroupMessage: !!result.groupMessage,
        hasPrivateMessages: !!result.privateMessages?.length,
        hasError: !!result.error,
      }, 'Command result');

      // Send group message(s)
      if (result.groupMessage) {
        const groupMessages = Array.isArray(result.groupMessage)
          ? result.groupMessage
          : [result.groupMessage];
        for (let i = 0; i < groupMessages.length; i++) {
          const gm = groupMessages[i];
          logger.debug({ groupId, msgLength: gm.length, part: i + 1, total: groupMessages.length }, 'Sending group message...');
          try {
            await client.sendMessage(groupId, gm);
            logger.debug({ groupId }, 'Group message sent successfully');
          } catch (sendErr) {
            logger.error({ sendErr, groupId, command: command.name }, 'Failed to send group message');
          }
          // Add delay between sequential messages (e.g. all-in runout)
          if (groupMessages.length > 1 && i < groupMessages.length - 1) {
            await delay(MESSAGE_DELAY_MS);
          }
        }
      }

      // Send private messages (hole cards, etc.)
      if (result.privateMessages) {
        for (const pm of result.privateMessages) {
          await delay(MESSAGE_DELAY_MS);
          logger.debug({ waId: pm.waId }, 'Sending private message...');
          try {
            await client.sendMessage(pm.waId, pm.message);
            logger.debug({ waId: pm.waId }, 'Private message sent');
          } catch (sendErr) {
            logger.error({ sendErr, waId: pm.waId }, 'Failed to send private message');
          }
        }
      }

      // Send error as reply
      if (result.error) {
        logger.debug({ error: result.error }, 'Sending error reply...');
        try {
          await msg.reply(result.error);
          logger.debug('Error reply sent');
        } catch (replyErr) {
          logger.error({ replyErr }, 'Failed to send error reply');
        }
      }
    } catch (err) {
      logger.error({ err, command: command.name }, 'Command execution failed');
      try {
        await msg.reply('An error occurred. Please try again.');
      } catch {
        logger.error('Failed to send error reply after command failure');
      }
    }
  });
}
