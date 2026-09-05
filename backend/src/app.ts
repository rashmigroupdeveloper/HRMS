import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { type Options as RateLimitOptions } from 'express-rate-limit';
import { logger } from './core/logger.js';
import { rateLimitsFromEnv } from './api/rate-limits.js';
import { getOpenApiSpec, orpcMiddleware, type AppDeps } from './api/handler.js';
import { registerAttendanceWorkflowHooks } from './modules/attendance/index.js';
import { registerClaimsWorkflowHooks } from './modules/claims/index.js';
import { registerLeaveWorkflowHooks } from './modules/leave/index.js';
import { registerLettersWorkflowHooks } from './modules/letters/index.js';

/**
 * Express app factory — pure, no I/O at import time; tests inject their own
 * deps (or none, for DB-less surface tests).
 *
 * Routing model (docs/14 §3):
 *  - /api/*            → oRPC procedures (zod input+output; the internal API)
 *  - /api/openapi.json → the generated contract the frontend team consumes
 *  - /health           → plain envelope endpoint for load-balancer checks
 */
/**
 * Rate limiting (audit W0-T37, findings [D4] [D5]).
 *
 * The audit ran 30 failed logins in ONE second, all processed. Consequences:
 * unthrottled credential stuffing; bcrypt-cost CPU exhaustion from a single
 * client; and — because account lockout works and is attacker-triggerable —
 * roughly 5,330 unauthenticated requests would lock all 1,066 employees out.
 * On the 28th of a month that stops payroll.
 *
 * TWO layers, because one is always wrong here. Rashmi's employees sit behind a
 * handful of office and plant egress addresses, so a tight per-IP login limit
 * would block the 09:00 rush — the limiter causing the outage it prevents. So:
 *
 *   · per (address + identifier): tight. Brute-forcing ONE account is stopped
 *     well before the account lockout that an attacker could otherwise use to
 *     lock every employee out.
 *   · per address: generous. Enough for a plant's morning, not enough for
 *     someone enumerating the whole master from one host.
 *
 * `trust proxy` is set below so `req.ip` is the client and not the reverse
 * proxy, without which every request shares one bucket.
 */
function limiter(
  windowMs: number,
  max: number,
  message: string,
  keyGenerator?: (req: Request) => string,
) {
  const options: Partial<RateLimitOptions> = {
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, data: null, error: message, meta: null },
    ...(keyGenerator === undefined ? {} : { keyGenerator }),
  };
  return rateLimit(options);
}

/** Whoever the caller says they are, plus where they are calling from. */
function identifierKey(req: Request): string {
  const body: unknown = req.body;
  const identifier =
    typeof body === 'object' && body !== null && 'identifier' in body && typeof body.identifier === 'string'
      ? body.identifier.toLowerCase()
      : '<none>';
  return `${req.ip ?? 'unknown'}|${identifier}`;
}

export function createApp(deps?: Partial<AppDeps>): Express {
  const isProduction = process.env['NODE_ENV'] === 'production';
  if (isProduction && deps?.jwtSecret === undefined) {
    // W0-T42 — the fallback below is a PUBLISHED constant. Reaching it in
    // production would mean anyone could forge a valid token.
    throw new Error('createApp: jwtSecret is required in production');
  }

  const resolved: AppDeps = {
    db: deps?.db ?? null,
    jwtSecret: deps?.jwtSecret ?? 'insecure-test-only-secret-never-in-production!',
    secureCookies: deps?.secureCookies ?? false,
  };

  // Domain reactions to workflow finals (approve → write-back) must be live
  // in every process that can finalize a request.
  registerAttendanceWorkflowHooks();
  registerClaimsWorkflowHooks();
  registerLeaveWorkflowHooks();
  registerLettersWorkflowHooks();

  const app = express();

  /**
   * The reverse proxy is the only thing in front of us (docs/02 §2), so trust
   * exactly one hop. `true` would let a client spoof X-Forwarded-For and walk
   * straight past the rate limiter.
   */
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  /**
   * Security headers (audit W0-T36, finding [D6]). The audit's `curl -i` showed
   * only `X-Powered-By: Express` — no HSTS, no nosniff, no frame-ancestors, no
   * CSP, no Referrer-Policy, on an application that approves resignations and
   * will move money.
   *
   * The CSP is deliberately strict: this API serves JSON, not HTML. The SPA is
   * served by the reverse proxy and carries its own policy.
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  /**
   * CORS (audit W0-T40, finding [D7]). `.env.example` advertised CORS_ORIGIN
   * and nothing read it; development worked only because Vite proxies /api.
   * An explicit allowlist, and `credentials: true` because the refresh cookie
   * travels on /api/auth — which is exactly why the origin list must never
   * become `*`.
   */
  const origins = (process.env['CORS_ORIGIN'] ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '');
  if (origins.length > 0) {
    app.use(cors({ origin: origins, credentials: true }));
  } else if (isProduction) {
    throw new Error('createApp: CORS_ORIGIN must be set in production');
  }

  /**
   * Body size (audit W0-T41, finding [D10]). The 100 kB default made the
   * document vault, policy publish and letter attachments non-functional for
   * any real file — a scanned PAN is 200 kB-2 MB. Raised deliberately here; the
   * per-document-type cap belongs in the validator (W1.4), not the parser.
   */
  app.use(express.json({ limit: '12mb' }));
  app.use(cookieParser());

  /**
   * Tests override these. A suite that legitimately logs in a dozen times is
   * not an attacker, and throttling it would make every integration file
   * fragile in a way that teaches people to disable the limiter rather than
   * trust it. `tests/http-hardening.integration.test.ts` passes tight values
   * and proves the limiter actually bites.
   */
  const limits = deps?.rateLimits ?? rateLimitsFromEnv();
  app.use(
    '/api/auth',
    limiter(15 * 60_000, limits.authPerIdentifier, 'Too many attempts for this account. Try again shortly.', identifierKey),
    limiter(15 * 60_000, limits.authPerAddress, 'Too many attempts from this address. Try again shortly.'),
  );
  app.use(
    '/api/security/step-up',
    limiter(15 * 60_000, limits.authPerAddress, 'Too many attempts from this address. Try again shortly.'),
  );
  app.use('/api/ird/posh/file-anonymous', limiter(60 * 60_000, limits.intakePerAddress, 'Too many submissions from this address. Try again later.'));
  app.use('/api/ird/whistle/file', limiter(60 * 60_000, limits.intakePerAddress, 'Too many submissions from this address. Try again later.'));
  app.use('/api', limiter(60_000, limits.globalPerAddress, 'Too many requests. Slow down and try again.'));

  // oRPC serves everything under /api; unmatched paths fall through.
  app.use(orpcMiddleware(resolved));

  app.get('/api/openapi.json', (_req, res, next) => {
    getOpenApiSpec()
      .then((spec) => res.json(spec))
      .catch(next);
  });

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      data: { status: 'ok', service: 'hrms-api' },
      error: null,
      meta: { ts: new Date().toISOString() },
    });
  });

  /**
   * The terminal error handler (audit W0-T39, finding [D8]).
   *
   * Without one, an unhandled throw escaped as Express's HTML error page — the
   * audit's 250 kB upload returned a 413 whose body contained a stack trace and
   * absolute server paths. The frontend's error parser cannot read HTML either,
   * so the user was shown "Request failed (413)" and told nothing.
   *
   * Four arguments, including `next`: Express identifies error middleware by
   * arity, so dropping the unused parameter silently turns this back into
   * ordinary middleware.
   */
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    // Express detects error middleware by ARITY, so this 4th parameter must
    // exist even though the handler is terminal. Delegating once the response
    // has started is also the correct behaviour — Express then closes the
    // connection rather than trying to write headers twice.
    if (res.headersSent) {
      next(err);
      return;
    }
    const status =
      typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 500;
    const message = err instanceof Error ? err.message : 'Unexpected error';

    logger.error({ err, path: req.path, method: req.method, status }, 'unhandled request error');

    res.status(status).json({
      success: false,
      data: null,
      // A stack never crosses the wire. 5xx says nothing at all: the detail is
      // in the server log, correlated by the log line above.
      error: status >= 500 ? 'Something went wrong on our side.' : message,
      meta: null,
    });
  });

  return app;
}
