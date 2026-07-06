import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnv } from './core/config/env.js';
import { logger } from './core/logger.js';

const env = loadEnv();
const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'hrms-api listening');
});
