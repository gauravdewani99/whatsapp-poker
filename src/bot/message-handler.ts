import type { WASocket, WAMessage } from '@whiskeysockets/baileys';
import { parseCommand } from './command-parser.js';
import type { CommandRegistry } from './command-registry.js';
import type { GroupActivationManager } from '../state/group-activation.js';
import { logger } from '../utils/logger.js';
import { MESSAGE_DELAY_MS } from '../utils/constants.js';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Extract text body from a Baileys WAMessage */
function getMessageText(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    null
  );
}

/** Commands that work even before the group is activated */
const UNGATED_COMMANDS = new Set(['help']);

export function registerMessageHandler(
  socket: WASocket,
  registry: CommandRegistry,
  activationManager: GroupActivationManager,
): void {
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    // Only process real-time messages, not history sync
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        await handleMessage(socket, msg, registry, activationManager);
      } catch (err) {
        logger.error({ err, msgId: msg.key.id }, 'Unhandled error processing message');
      }
    }
  });
}

async function handleMessage(
  socket: WASocket,
  msg: WAMessage,
  registry: CommandRegistry,
  activationManager: GroupActivationManager,
): Promise<void> {
  // Skip our own messages
  if (msg.key.fromMe) return;

  const body = getMessageText(msg);
  if (!body || !body.startsWith('!')) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  // Only process group messages
  const isGroup = remoteJid.endsWith('@g.us');
  if (!isGroup) return;

  const groupId = remoteJid;
  const senderWaId = msg.key.participant || remoteJid;
  const senderName = msg.pushName || 'Unknown';

  logger.debug({ body, groupId, senderWaId, senderName }, 'Command detected');

  const command = parseCommand(body, senderWaId, senderName, groupId);
  if (!command) return;

  logger.info({ command: command.name, sender: senderName, group: groupId }, 'Command received');

  // Auto-activate group on first command — if the bot is receiving messages, it's in the group
  if (!activationManager.isActive(groupId)) {
    activationManager.activate(groupId);
    logger.info({ groupId }, 'Group auto-activated on first command');
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
          await socket.sendMessage(groupId, { text: gm });
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
          await socket.sendMessage(pm.waId, { text: pm.message });
          logger.debug({ waId: pm.waId }, 'Private message sent');
        } catch (sendErr) {
          logger.error({ sendErr, waId: pm.waId }, 'Failed to send private message');
        }
      }
    }

    // Send error as reply in the group
    if (result.error) {
      logger.debug({ error: result.error }, 'Sending error reply...');
      try {
        await socket.sendMessage(groupId, {
          text: result.error,
          quoted: msg,
        } as any);
        logger.debug('Error reply sent');
      } catch (replyErr) {
        logger.error({ replyErr }, 'Failed to send error reply');
      }
    }
  } catch (err) {
    logger.error({ err, command: command.name }, 'Command execution failed');
    try {
      await socket.sendMessage(groupId, { text: 'An error occurred. Please try again.' });
    } catch {
      logger.error('Failed to send error reply after command failure');
    }
  }
}
