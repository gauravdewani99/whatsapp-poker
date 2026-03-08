import { desc, sql, eq, inArray } from 'drizzle-orm';
import type { DB } from '../connection.js';
import { feedback } from '../schema.js';

export interface FeedbackRow {
  id: number;
  waId: string;
  displayName: string;
  groupId: string | null;
  message: string;
  processed: number;
  createdAt: string;
}

export class FeedbackRepository {
  constructor(private db: DB) {}

  async insert(waId: string, displayName: string, groupId: string | null, message: string): Promise<void> {
    await this.db
      .insert(feedback)
      .values({ waId, displayName, groupId, message });
  }

  /** Get feedback from the last N hours, newest first. */
  async getRecent(hours: number): Promise<FeedbackRow[]> {
    return await this.db
      .select()
      .from(feedback)
      .where(sql`${feedback.createdAt} >= (NOW() - INTERVAL '1 hour' * ${hours})::text`)
      .orderBy(desc(feedback.createdAt)) as FeedbackRow[];
  }

  /** Get unprocessed feedback from the last N hours. */
  async getUnprocessed(hours: number): Promise<FeedbackRow[]> {
    return await this.db
      .select()
      .from(feedback)
      .where(sql`${feedback.processed} = 0 AND ${feedback.createdAt} >= (NOW() - INTERVAL '1 hour' * ${hours})::text`)
      .orderBy(desc(feedback.createdAt)) as FeedbackRow[];
  }

  /** Mark feedback entries as processed. */
  async markAsProcessed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(feedback)
      .set({ processed: 1 })
      .where(inArray(feedback.id, ids));
  }
}
