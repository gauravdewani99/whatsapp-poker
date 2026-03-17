import type { WASocket, WAMessage } from '@whiskeysockets/baileys';
import { parseCommand } from './command-parser.js';
import type { CommandRegistry } from './command-registry.js';
import type { GroupActivationManager } from '../state/group-activation.js';
import type { CommandName } from '../models/command.js';
import { welcomeMessage, dmWelcomeMessage, dmCommandRejectionMessage } from '../messages/templates.js';
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

/** Standalone commands that can be used in personal DMs (no table/group state needed) */
const DM_ALLOWED_COMMANDS = new Set<CommandName>([
  'help', 'rules', 'stats', 'feedback',
  'ragebait', 'needle', 'tight', 'fish', 'shame', 'gg',
]);

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
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  const isGroup = remoteJid.endsWith('@g.us');

  // ─── DM handling ───────────────────────────────────────────────────────
  if (!isGroup) {
    if (!body) return;

    if (body.startsWith('!')) {
      // DM command — check if it's allowed
      const senderWaId = remoteJid;
      const senderName = msg.pushName || 'Unknown';
      const command = parseCommand(body, senderWaId, senderName, remoteJid);

      if (command && DM_ALLOWED_COMMANDS.has(command.name)) {
        // Execute the standalone command and send response back as DM
        try {
          logger.info({ command: command.name, sender: senderName }, 'DM command received');
          const result = await registry.execute(command);

          if (result.groupMessage) {
            const msgs = Array.isArray(result.groupMessage) ? result.groupMessage : [result.groupMessage];
            for (const m of msgs) {
              await socket.sendMessage(remoteJid, { text: m });
            }
          }
          if (result.error) {
            await socket.sendMessage(remoteJid, { text: result.error });
          }
        } catch (err) {
          logger.error({ err, remoteJid }, 'Failed to handle DM command');
        }
      } else {
        // Game command in DM → graceful rejection
        try {
          await socket.sendMessage(remoteJid, { text: dmCommandRejectionMessage() });
        } catch (err) {
          logger.error({ err, remoteJid }, 'Failed to send DM command rejection');
        }
      }
    } else {
      // Non-command DM → welcome message
      try {
        await socket.sendMessage(remoteJid, { text: dmWelcomeMessage() });
      } catch (err) {
        logger.error({ err, remoteJid }, 'Failed to send DM welcome');
      }
    }
    return;
  }

  // ─── Group handling (unchanged) ────────────────────────────────────────
  if (!body || !body.startsWith('!')) return;

  const groupId = remoteJid;
  const senderWaId = msg.key.participant || remoteJid;
  const senderName = msg.pushName || 'Unknown';

  logger.debug({ body, groupId, senderWaId, senderName }, 'Command detected');

  const command = parseCommand(body, senderWaId, senderName, groupId);
  if (!command) return;

  logger.info({ command: command.name, sender: senderName, group: groupId }, 'Command received');

  // Auto-activate group on first command — if the bot is receiving messages, it's in the group
  if (!activationManager.isActive(groupId)) {
    await activationManager.activate(groupId);
    logger.info({ groupId }, 'Group auto-activated on first command');

    // Send welcome message as fallback (the Baileys group-participants.update event was missed)
    try {
      await socket.sendMessage(groupId, { text: welcomeMessage() });
      logger.info({ groupId }, 'Welcome message sent (fallback on first command)');
    } catch (err) {
      logger.error({ err, groupId }, 'Failed to send fallback welcome message');
    }
  }

  try {
    const result = await registry.execute(command);

    // Reset idle timer on every successful command if a table is active
    const tm = registry.getTableManager();
    const idleTimer = registry.getIdleTimer();
    if (idleTimer && tm.getTable(groupId)) {
      idleTimer.resetTimer(groupId, async () => {
        // Auto-close callback
        try {
          const table = tm.getTable(groupId);
          if (!table) return;

          // Find creator display name
          const creatorSeat = table.seats.find(s => s?.waId === table.creatorWaId);
          const creatorName = creatorSeat?.displayName
            || table.leftPlayers.find(lp => lp.waId === table.creatorWaId)?.displayName
            || 'friend';

          // Return chips to seated players
          const { PlayerRepository } = await import('../db/repositories/player-repo.js');
          const { GroupStatsRepository } = await import('../db/repositories/group-stats-repo.js');
          const { GameRepository } = await import('../db/repositories/game-repo.js');
          const db = registry.getDB();
          const playerRepo = new PlayerRepository(db);

          const seatedPlayers = table.seats.filter((s): s is import('../models/player.js').SeatPlayer => s !== null);
          for (const seat of seatedPlayers) {
            const profile = await playerRepo.findByWaId(seat.waId);
            if (profile) {
              await playerRepo.updateBalance(profile.id, profile.chipBalance + seat.chipStack);
              await playerRepo.addCashOut(profile.id, seat.chipStack);
            }
          }
          // Record lifetime cash-out for players who left mid-session
          for (const lp of table.leftPlayers) {
            const profile = await playerRepo.findByWaId(lp.waId);
            if (profile) {
              await playerRepo.addCashOut(profile.id, lp.cashOut);
            }
          }

          // Record session stats (seated + left players)
          const groupStatsRepo = new GroupStatsRepository(db);
          const allSessionPlayers = [
            ...seatedPlayers.map(seat => ({
              waId: seat.waId,
              displayName: seat.displayName,
              buyIn: seat.buyInAmount,
              cashOut: seat.chipStack,
              handsPlayed: seat.sessionHandsPlayed,
              handsWon: seat.sessionHandsWon,
            })),
            ...table.leftPlayers.map(lp => ({
              waId: lp.waId,
              displayName: lp.displayName,
              buyIn: lp.buyInAmount,
              cashOut: lp.cashOut,
              handsPlayed: lp.handsPlayed,
              handsWon: lp.handsWon,
            })),
          ];
          await groupStatsRepo.recordSessionEnd(groupId, allSessionPlayers);

          // End game in DB
          const gameRepo = new GameRepository(db);
          await gameRepo.endGame(table.gameId);

          // Clear turn timer and remove table
          const turnTimer = registry.getTurnTimer();
          if (turnTimer) turnTimer.clearTimer(groupId);
          tm.removeTable(groupId);

          // Send auto-close message
          await socket.sendMessage(groupId, {
            text: `\u2660\uFE0F No activity for 10 minutes. The House is closing the table, *${creatorName}*. All chips returned. Until next time.`,
          });
          logger.info({ groupId, creatorName }, 'Table auto-closed due to inactivity');
        } catch (err) {
          logger.error({ err, groupId }, 'Failed to auto-close idle table');
        }
      });
    }

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
