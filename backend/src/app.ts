import { env } from '#core/config/env'
import { errorHandler, notFoundHandler } from '#core/http/error-handler'
import { requestLogger } from '#core/http/request-logger'
import { createRpcMiddleware } from '#core/rpc/handler'
import { accountsService } from '#modules/accounts'
import { candidatePortalService } from '#modules/candidates'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { router } from './router.js'

export function createApp() {
  const app = express()
  // The real caller's IP (kept as proof when a candidate answers an offer online). A proxy on this same machine - Vite
  // in development, nginx / IIS on the server - forwards requests, so the connection always comes from it; trusting
  // only such a local proxy's X-Forwarded-For gives the browser's address, and a caller from outside cannot fake it.
  app.set('trust proxy', 'loopback')

  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: true }))
  app.use(requestLogger)

  // oRPC reads request bodies itself, so no express.json() before it.
  app.use(
    createRpcMiddleware(router, { resolveUser: accountsService.resolveUser, resolveCandidate: candidatePortalService.resolveCandidate }),
  )

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
