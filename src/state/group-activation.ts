import { eq } from 'drizzle-orm';
import type { DB } from '../db/connection.js';
import { activatedGroups } from '../db/schema.js';

/**
 * Tracks which WhatsApp groups have activated the poker bot via !play.
 * Backed by the activated_groups DB table — survives restarts.
 */
export class GroupActivationManager {
  private activeGroups: Set<string> = new Set();

  constructor(private db: DB) {
    // Load existing activations from DB
    const rows = this.db.select().from(activatedGroups).all();
    for (const row of rows) {
      this.activeGroups.add(row.groupId);
    }
  }

  /** Activate a group. Returns true if newly activated, false if already active. */
  activate(groupId: string): boolean {
    if (this.activeGroups.has(groupId)) {
      return false;
    }
    this.activeGroups.add(groupId);
    this.db.insert(activatedGroups)
      .values({ groupId })
      .onConflictDoNothing()
      .run();
    return true;
  }

  deactivate(groupId: string): void {
    this.activeGroups.delete(groupId);
    this.db.delete(activatedGroups)
      .where(eq(activatedGroups.groupId, groupId))
      .run();
  }

  isActive(groupId: string): boolean {
    return this.activeGroups.has(groupId);
  }

  /** Get all active group IDs (used by nudge scheduler). */
  getActiveGroupIds(): string[] {
    return Array.from(this.activeGroups);
  }
}
