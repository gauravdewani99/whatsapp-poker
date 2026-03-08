import { eq } from 'drizzle-orm';
import type { DB } from '../db/connection.js';
import { activatedGroups } from '../db/schema.js';

/**
 * Tracks which WhatsApp groups have activated the poker bot via !play.
 * Backed by the activated_groups DB table — survives restarts.
 */
export class GroupActivationManager {
  private activeGroups: Set<string> = new Set();

  constructor(private db: DB) {}

  /** Load existing activations from DB. Must be called after construction. */
  async init(): Promise<void> {
    const rows = await this.db.select().from(activatedGroups);
    for (const row of rows) {
      this.activeGroups.add(row.groupId);
    }
  }

  /** Activate a group. Returns true if newly activated, false if already active. */
  async activate(groupId: string): Promise<boolean> {
    if (this.activeGroups.has(groupId)) {
      return false;
    }
    this.activeGroups.add(groupId);
    await this.db.insert(activatedGroups)
      .values({ groupId })
      .onConflictDoNothing();
    return true;
  }

  async deactivate(groupId: string): Promise<void> {
    this.activeGroups.delete(groupId);
    await this.db.delete(activatedGroups)
      .where(eq(activatedGroups.groupId, groupId));
  }

  isActive(groupId: string): boolean {
    return this.activeGroups.has(groupId);
  }

  /** Get all active group IDs (used by nudge scheduler). */
  getActiveGroupIds(): string[] {
    return Array.from(this.activeGroups);
  }
}
