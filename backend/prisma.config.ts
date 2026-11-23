import { existsSync } from 'node:fs'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 does not read .env on its own, so load it here (Node built-in, no dotenv needed).
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  // A folder: Prisma merges every *.prisma file inside it (one file per domain).
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
