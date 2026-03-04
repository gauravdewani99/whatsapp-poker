import type { WASocket } from '@whiskeysockets/baileys';
import type { GroupActivationManager } from '../state/group-activation.js';
import { welcomeMessage } from '../messages/templates.js';
import { logger } from '../utils/logger.js';

/**
 * Listens for the bot being added to a group.
 * When detected, auto-activates the group and sends a welcome message.
 */
export function registerWelcomeHandler(
  socket: WASocket,
  activationManager: GroupActivationManager,
): void {
  const botJid = socket.user?.id;
  if (!botJid) {
    logger.warn('Bot JID not available yet — welcome handler may not detect additions');
  }

  socket.ev.on('group-participants.update', async (event) => {
    try {
      const { id: groupId, participants, action } = event;

      if (action !== 'add') return;

      // Check if any of the added participants is the bot itself
      // Bot JID format: "number:0@s.whatsapp.net" or "number@s.whatsapp.net"
      const currentBotJid = socket.user?.id;
      if (!currentBotJid) {
        logger.warn({ groupId, participants }, 'Bot JID not available — cannot check if bot was added');
        return;
      }

      // Normalize: strip the ":0" suffix that Baileys sometimes adds
      const botNumber = currentBotJid.split(':')[0].split('@')[0];

      const botWasAdded = participants.some(p => {
        const pNumber = p.split(':')[0].split('@')[0];
        return pNumber === botNumber;
      });

      if (!botWasAdded) return;

      logger.info({ groupId }, 'Bot was added to a group — auto-activating');

      // Auto-activate the group
      activationManager.activate(groupId);

      // Send welcome message
      await socket.sendMessage(groupId, { text: welcomeMessage() });
      logger.info({ groupId }, 'Welcome message sent');
    } catch (err) {
      logger.error({ err }, 'Error in welcome handler');
    }
  });
}
