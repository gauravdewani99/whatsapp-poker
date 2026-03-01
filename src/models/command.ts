export type CommandName =
  | 'play'
  | 'start' | 'join' | 'leave' | 'deal'
  | 'fold' | 'check' | 'call' | 'raise' | 'all-in'
  | 'status' | 'balance' | 'cashout'
  | 'help' | 'stop' | 'kick' | 'history' | 'rebuy' | 'stats' | 'rules' | 'standings'
  | 'taunt' | 'ragebait'
  | 'needle' | 'tight'
  | 'show' | 'gg' | 'reset';

export interface ParsedCommand {
  name: CommandName;
  args: string[];
  rawText: string;
  senderWaId: string;
  senderName: string;
  groupId: string;
  timestamp: number;
}

export interface CommandResult {
  groupMessage?: string | string[];
  privateMessages?: Array<{
    waId: string;
    message: string;
  }>;
  error?: string;
}
