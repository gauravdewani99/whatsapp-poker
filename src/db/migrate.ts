import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const pool = new pg.Pool({ connectionString: config.databaseUrl });
const db = drizzle(pool);
logger.info('Running migrations...');
await migrate(db, { migrationsFolder: './drizzle' });
logger.info('Migrations complete.');
await pool.end();
