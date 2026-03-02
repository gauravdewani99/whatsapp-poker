import type { ParsedCommand, CommandResult, CommandName } from '../models/command.js';
import type { TableManager } from '../state/table-manager.js';
import type { TurnTimer } from '../state/turn-timer.js';
import type { KickVoteManager } from '../state/kick-vote-manager.js';
import type { BotManager } from './bot-manager.js';
import type { DB } from '../db/connection.js';

export type CommandHandler = (command: ParsedCommand) => CommandResult | Promise<CommandResult>;

export class CommandRegistry {
  private handlers: Map<CommandName, CommandHandler> = new Map();
  private _turnTimer: TurnTimer | null = null;
  private _botManager: BotManager | null = null;
  private _kickVoteManager: KickVoteManager | null = null;

  constructor(
    private tableManager: TableManager,
    private db: DB,
  ) {}

  register(name: CommandName, handler: CommandHandler): void {
    this.handlers.set(name, handler);
  }

  async execute(command: ParsedCommand): Promise<CommandResult> {
    const handler = this.handlers.get(command.name);
    if (!handler) {
      return { error: `Unknown command: ${command.name}. Type !help for a list of commands.` };
    }
    return handler(command);
  }

  getTableManager(): TableManager {
    return this.tableManager;
  }

  getDB(): DB {
    return this.db;
  }

  setTurnTimer(timer: TurnTimer): void {
    this._turnTimer = timer;
  }

  getTurnTimer(): TurnTimer | null {
    return this._turnTimer;
  }

  setBotManager(botManager: BotManager): void {
    this._botManager = botManager;
  }

  getBotManager(): BotManager | null {
    return this._botManager;
  }

  setKickVoteManager(kickVoteManager: KickVoteManager): void {
    this._kickVoteManager = kickVoteManager;
  }

  getKickVoteManager(): KickVoteManager | null {
    return this._kickVoteManager;
  }
}
