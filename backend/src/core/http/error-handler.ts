import type { ErrorRequestHandler, RequestHandler } from 'express'
import { env } from '../config/env.js'

// API errors (from procedures) are handled by oRPC in rpc/handler.ts.
// These two only cover requests that never reach oRPC.

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500
  const message =
    status >= 500 && env.NODE_ENV === 'production' ? 'Internal server error' : String(err?.message ?? err)
  res.status(status).json({ message })
}
