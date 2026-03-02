import type { BotManager } from '../bot/bot-manager.js';
import { logger } from '../utils/logger.js';

export interface KickVoteResult {
  error?: string;
  completed?: boolean;
  approved?: boolean;
  targetWaId?: string;
  targetName?: string;
  remainingVoters?: number;
}

interface KickVote {
  groupId: string;
  targetWaId: string;
  targetName: string;
  initiatorWaId: string;
  requiredVoters: Set<string>;
  yesVotes: Set<string>;
  noVotes: Set<string>;
  timeout: NodeJS.Timeout;
  startedAt: number;
}

export class KickVoteManager {
  private activeVotes: Map<string, KickVote> = new Map();

  constructor(private botManager: BotManager) {}

  startVote(
    groupId: string,
    targetWaId: string,
    targetName: string,
    initiatorWaId: string,
    activePlayers: string[],
  ): KickVoteResult {
    if (this.activeVotes.has(groupId)) {
      return { error: 'A kick vote is already in progress. Wait for it to finish.' };
    }

    const requiredVoters = new Set(activePlayers);
    const yesVotes = new Set<string>();
    const noVotes = new Set<string>();

    // Initiator's vote counts as yes automatically
    yesVotes.add(initiatorWaId);

    // Check if vote is immediately complete (only 1 voter = initiator)
    if (requiredVoters.size === 1 && requiredVoters.has(initiatorWaId)) {
      return {
        completed: true,
        approved: true,
        targetWaId,
        targetName,
        remainingVoters: 0,
      };
    }

    // Set 60-second timeout
    const timeout = setTimeout(() => {
      this.activeVotes.delete(groupId);
      this.botManager.sendGroupMessage(
        groupId,
        `\u23F0 Kick vote for *${targetName}* expired. Not enough votes.`,
      );
      logger.info({ groupId, targetName }, 'Kick vote expired');
    }, 60_000);

    this.activeVotes.set(groupId, {
      groupId,
      targetWaId,
      targetName,
      initiatorWaId,
      requiredVoters,
      yesVotes,
      noVotes,
      timeout,
      startedAt: Date.now(),
    });

    const remaining = requiredVoters.size - yesVotes.size - noVotes.size;

    return {
      completed: false,
      targetWaId,
      targetName,
      remainingVoters: remaining,
    };
  }

  castVote(groupId: string, voterWaId: string, approve: boolean): KickVoteResult {
    const vote = this.activeVotes.get(groupId);
    if (!vote) {
      return { error: 'No kick vote in progress.' };
    }

    if (!vote.requiredVoters.has(voterWaId)) {
      return { error: "You're not eligible to vote (not at the table or you're the target)." };
    }

    if (vote.yesVotes.has(voterWaId) || vote.noVotes.has(voterWaId)) {
      return { error: "You've already voted." };
    }

    if (approve) {
      vote.yesVotes.add(voterWaId);
    } else {
      vote.noVotes.add(voterWaId);
      // Any no vote immediately cancels
      clearTimeout(vote.timeout);
      this.activeVotes.delete(groupId);
      return {
        completed: true,
        approved: false,
        targetWaId: vote.targetWaId,
        targetName: vote.targetName,
        remainingVoters: 0,
      };
    }

    const remaining = vote.requiredVoters.size - vote.yesVotes.size - vote.noVotes.size;

    // Check if all votes are in (unanimous yes)
    if (remaining === 0) {
      clearTimeout(vote.timeout);
      this.activeVotes.delete(groupId);
      return {
        completed: true,
        approved: true,
        targetWaId: vote.targetWaId,
        targetName: vote.targetName,
        remainingVoters: 0,
      };
    }

    return {
      completed: false,
      targetWaId: vote.targetWaId,
      targetName: vote.targetName,
      remainingVoters: remaining,
    };
  }

  getActiveVote(groupId: string): KickVote | null {
    return this.activeVotes.get(groupId) || null;
  }

  /** Clean up all active votes (called on shutdown). */
  clearAll(): void {
    for (const vote of this.activeVotes.values()) {
      clearTimeout(vote.timeout);
    }
    this.activeVotes.clear();
  }
}
