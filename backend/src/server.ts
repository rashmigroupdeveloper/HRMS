import { env } from '#core/config/env'
import { prisma } from '#core/db/prisma'
import { createApp } from './app.js'

const app = createApp()

const server = app.listen(env.PORT, (error) => {
  if (error) throw error
  console.log(`API ready on http://localhost:${env.PORT}/api/rpc`)
})

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
