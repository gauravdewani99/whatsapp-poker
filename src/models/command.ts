export type CommandName =
  | 'start' | 'join' | 'leave' | 'deal'
  | 'fold' | 'check' | 'call' | 'raise' | 'all-in'
  | 'status' | 'cashout'
  | 'help' | 'stop' | 'kick' | 'history' | 'rebuy' | 'stats' | 'rules' | 'stacks'
  | 'buyins' | 'groupstats'
  | 'sitout' | 'sitin' | 'feedback'
  | 'ragebait'
  | 'needle' | 'tight'
  | 'fish' | 'shame'
  | 'show' | 'gg'
  | 'rim';

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
