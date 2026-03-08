import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';

export type DB = ReturnType<typeof initDatabase>;

export function initDatabase() {
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  logger.info('Connected to PostgreSQL');
  return drizzle(pool, { schema });
}
