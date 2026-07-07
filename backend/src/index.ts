import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnv } from './core/config/env.js';
import { createDatabase } from './core/db/database.js';
import { logger } from './core/logger.js';

const env = loadEnv();
const db = createDatabase(env.DATABASE_URL);

const app = createApp({
  db,
  jwtSecret: env.JWT_SECRET,
  secureCookies: env.NODE_ENV === 'production',
});

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'hrms-api listening');
});
