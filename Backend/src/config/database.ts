import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.info('✅ Database connected successfully');
});

pool.on('error', (err: Error) => {
  logger.error(`❌ Unexpected database error: ${err.message}`);
  process.exit(-1);
});

export default pool;
