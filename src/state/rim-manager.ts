import type { BotManager } from '../bot/bot-manager.js';
import { logger } from '../utils/logger.js';

export interface RimVoteResult {
  message: string;
  resolved?: number; // defined when vote is complete — the agreed-upon run count
}

interface RimVote {
  groupId: string;
  eligibleVoters: Set<string>;
  votes: Map<string, number>; // waId → 1|2|3
  timeout: NodeJS.Timeout;
  onResolve: (runs: number) => void;
}

const VOTE_TIMEOUT_MS = 30_000;

export class RimManager {
  private activeVotes: Map<string, RimVote> = new Map();

  constructor(private botManager: BotManager) {}

  /**
   * Start a RIM vote for a group.
   * @param onResolve — called on timeout with the resolved run count.
   *   When resolved via castVote(), the caller handles execution directly.
   */
  startVote(
    groupId: string,
    eligibleVoters: string[],
    onResolve: (runs: number) => void,
  ): void {
    // Clean up any stale vote
    const existing = this.activeVotes.get(groupId);
    if (existing) {
      clearTimeout(existing.timeout);
      this.activeVotes.delete(groupId);
    }

    const voters = new Set(eligibleVoters);

    const timeout = setTimeout(() => {
      const vote = this.activeVotes.get(groupId);
      if (!vote) return;
      this.activeVotes.delete(groupId);

      // Resolve: minimum of cast votes, default 1 if none cast
      const castValues = [...vote.votes.values()];
      const runs = castValues.length > 0 ? Math.min(...castValues) : 1;

      logger.info({ groupId, runs, votesReceived: castValues.length }, 'RIM vote timed out');
      this.botManager.sendGroupMessage(
        groupId,
        `\u23F0 Time's up! Running it *${runs === 1 ? 'once' : runs === 2 ? 'twice' : 'thrice'}*.`,
      );
      vote.onResolve(runs);
    }, VOTE_TIMEOUT_MS);

    this.activeVotes.set(groupId, {
      groupId,
      eligibleVoters: voters,
      votes: new Map(),
      timeout,
      onResolve,
    });
  }

  castVote(groupId: string, voterWaId: string, runs: number): RimVoteResult {
    const vote = this.activeVotes.get(groupId);
    if (!vote) {
      return { message: 'No run-it-multiple vote in progress.' };
    }

    if (!vote.eligibleVoters.has(voterWaId)) {
      return { message: "You're not in this hand." };
    }

    if (vote.votes.has(voterWaId)) {
      return { message: "You've already voted." };
    }

    vote.votes.set(voterWaId, runs);

    const remaining = vote.eligibleVoters.size - vote.votes.size;

    // Check if all votes are in
    if (remaining === 0) {
      clearTimeout(vote.timeout);
      this.activeVotes.delete(groupId);

      const resolved = Math.min(...vote.votes.values());
      const label = resolved === 1 ? 'once' : resolved === 2 ? 'twice' : 'thrice';
      logger.info({ groupId, resolved, votes: Object.fromEntries(vote.votes) }, 'RIM vote resolved');

      return {
        message: `All votes in! Running it *${label}*.`,
        resolved,
      };
    }

    // Find voter display name — we don't have it here, so use a generic message
    const label = runs === 1 ? 'once' : runs === 2 ? 'twice' : 'thrice';
    return {
      message: `Voted *!${runs}* (${label}). Waiting for ${remaining} more vote${remaining > 1 ? 's' : ''}...`,
    };
  }

  hasActiveVote(groupId: string): boolean {
    return this.activeVotes.has(groupId);
  }

  /** Clean up all active votes (called on shutdown). */
  clearAll(): void {
    for (const vote of this.activeVotes.values()) {
      clearTimeout(vote.timeout);
    }
    this.activeVotes.clear();
  }
}
