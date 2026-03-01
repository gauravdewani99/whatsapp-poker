import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';
import { createDefaultConfig } from '../../models/game.js';
import { PlayerRepository } from '../../db/repositories/player-repo.js';
import { GameRepository } from '../../db/repositories/game-repo.js';
import * as templates from '../../messages/templates.js';
import { config } from '../../config.js';

export function registerStartCommand(registry: CommandRegistry): void {
  registry.register('start', (command: ParsedCommand): CommandResult => {
    const tm = registry.getTableManager();
    const db = registry.getDB();

    if (tm.hasTable(command.groupId)) {
      return { error: 'A table is already active in this group. Use !poker stop to end it first.' };
    }

    // Parse blinds: !poker start 100/200
    const blindsArg = command.args[0];
    if (!blindsArg || !blindsArg.includes('/')) {
      return { error: 'Usage: !poker start <small_blind>/<big_blind>\nExample: !poker start 100/200' };
    }

    const [sbStr, bbStr] = blindsArg.split('/');
    const smallBlind = parseInt(sbStr, 10);
    const bigBlind = parseInt(bbStr, 10);

    if (isNaN(smallBlind) || isNaN(bigBlind) || smallBlind <= 0 || bigBlind <= 0) {
      return { error: 'Blinds must be positive numbers. Example: !poker start 100/200' };
    }

    if (bigBlind <= smallBlind) {
      return { error: 'Big blind must be greater than small blind.' };
    }

    const gameConfig = createDefaultConfig(command.groupId, smallBlind, bigBlind);

    // Create player profile if needed
    const playerRepo = new PlayerRepository(db);
    const player = playerRepo.findOrCreate(
      command.senderWaId,
      command.senderName,
      config.defaultStartingChips,
    );

    // Create game in DB
    const gameRepo = new GameRepository(db);
    const gameId = gameRepo.createGame(
      command.groupId,
      smallBlind,
      bigBlind,
      gameConfig.minBuyIn,
      gameConfig.maxBuyIn,
      player.id,
    );

    // Create table in memory
    tm.createTable(command.groupId, gameConfig, gameId, command.senderWaId);

    return {
      groupMessage: templates.gameStartMessage(smallBlind, bigBlind, gameConfig.minBuyIn, gameConfig.maxBuyIn),
    };
  });
}
