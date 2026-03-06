import { desc, sql } from 'drizzle-orm';
import type { DB } from '../connection.js';
import { feedback } from '../schema.js';

export interface FeedbackRow {
  id: number;
  waId: string;
  displayName: string;
  groupId: string | null;
  message: string;
  createdAt: string;
}

export class FeedbackRepository {
  constructor(private db: DB) {}

  insert(waId: string, displayName: string, groupId: string | null, message: string): void {
    this.db
      .insert(feedback)
      .values({ waId, displayName, groupId, message })
      .run();
  }

  /** Get feedback from the last N hours, newest first. */
  getRecent(hours: number): FeedbackRow[] {
    return this.db
      .select()
      .from(feedback)
      .where(sql`${feedback.createdAt} >= datetime('now', '-' || ${hours} || ' hours')`)
      .orderBy(desc(feedback.createdAt))
      .all() as FeedbackRow[];
  }
}
