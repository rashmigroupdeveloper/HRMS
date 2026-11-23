import { prisma, type DbClient } from '#core/db/prisma'

// Runs a trivial query; throws if the database cannot be reached.
export async function ping(db: DbClient = prisma): Promise<void> {
  await db.$queryRaw`SELECT 1`
}
