import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config.js';
import * as schema from './schema.js';
import { mkdirSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from '../utils/logger.js';

export type DB = ReturnType<typeof initDatabase>;

/** Ensure all tables exist (idempotent). Handles schema additions without full migration tooling. */
function ensureTables(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wa_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      chip_balance INTEGER NOT NULL DEFAULT 0,
      total_buy_in INTEGER NOT NULL DEFAULT 0,
      total_cash_out INTEGER NOT NULL DEFAULT 0,
      hands_played INTEGER NOT NULL DEFAULT 0,
      hands_won INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      small_blind INTEGER NOT NULL,
      big_blind INTEGER NOT NULL,
      min_buy_in INTEGER NOT NULL,
      max_buy_in INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_by INTEGER NOT NULL REFERENCES players(id),
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      hand_number INTEGER NOT NULL,
      dealer_seat INTEGER NOT NULL,
      community_cards TEXT,
      pot_total INTEGER NOT NULL DEFAULT 0,
      winners_json TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS hand_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hand_id INTEGER NOT NULL REFERENCES hands(id),
      player_id INTEGER NOT NULL REFERENCES players(id),
      seat_position INTEGER NOT NULL,
      hole_cards TEXT,
      chips_before INTEGER NOT NULL,
      chips_after INTEGER NOT NULL,
      final_action TEXT
    );

    CREATE TABLE IF NOT EXISTS activated_groups (
      group_id TEXT PRIMARY KEY,
      activated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wa_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      group_id TEXT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hand_id INTEGER NOT NULL REFERENCES hands(id),
      player_id INTEGER NOT NULL REFERENCES players(id),
      phase TEXT NOT NULL,
      action_type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      pot_after INTEGER NOT NULL,
      sequence INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_player_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      wa_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      sessions_played INTEGER NOT NULL DEFAULT 0,
      hands_played INTEGER NOT NULL DEFAULT 0,
      hands_won INTEGER NOT NULL DEFAULT 0,
      total_buy_in INTEGER NOT NULL DEFAULT 0,
      total_cash_out INTEGER NOT NULL DEFAULT 0,
      biggest_pot INTEGER NOT NULL DEFAULT 0,
      last_played_at TEXT,
      UNIQUE(group_id, wa_id)
    );
  `);
}

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
    ensureTables(sqlite);
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
