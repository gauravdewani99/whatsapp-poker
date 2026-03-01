import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config.js';
import * as schema from './schema.js';
import { mkdirSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from '../utils/logger.js';

export type DB = ReturnType<typeof initDatabase>;

export function initDatabase() {
  const dbPath = config.databasePath;
  mkdirSync(dirname(dbPath), { recursive: true });

  // Clean up stale WAL/SHM files that may be corrupt after a hard crash.
  // SQLite recreates them on open. The SHM is just a shared-memory index;
  // better-sqlite3 will safely replay any uncommitted WAL entries.
  for (const suffix of ['-shm', '-wal']) {
    try {
      unlinkSync(dbPath + suffix);
      logger.info({ file: dbPath + suffix }, 'Removed stale SQLite file');
    } catch {
      // Doesn't exist — that's fine
    }
  }

  try {
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    return drizzle(sqlite, { schema });
  } catch (err: any) {
    // If the DB file itself is corrupt (e.g. SQLITE_IOERR after hard crash),
    // delete it and start fresh. The data is non-critical (group activations,
    // game history) and will be repopulated.
    if (err?.code?.startsWith?.('SQLITE_IOERR') || err?.code?.startsWith?.('SQLITE_CORRUPT')) {
      logger.warn({ err, dbPath }, 'Database file corrupt — deleting and recreating');
      try { unlinkSync(dbPath); } catch { /* already gone */ }
      const sqlite = new Database(dbPath);
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('foreign_keys = ON');
      return drizzle(sqlite, { schema });
    }
    throw err;
  }
}
