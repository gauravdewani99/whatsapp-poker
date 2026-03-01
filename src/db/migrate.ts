import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { initDatabase } from './connection.js';
import { logger } from '../utils/logger.js';

const db = initDatabase();
logger.info('Running migrations...');
migrate(db, { migrationsFolder: './drizzle' });
logger.info('Migrations complete.');
