import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { ForbiddenError } from '../../core/errors/index.js';
import {
  feedbackIdentity,
  feedbackScreenshot,
  getFeedback,
  listFeedback,
  reviewFeedback,
  screenshotLimit,
  submitFeedback,
} from './feedback.service.js';
const id = z.coerce.number().int().positive();
const status = z.enum(['new', 'resolved']);
const pagePath = z
  .string()
  .min(1)
  .max(1500)
  .regex(/^\/(?!\/)[^?#\\\s]*$/, 'Use a page path without query parameters or fragments');
const report = z.object({
  id: z.number(),
  ecode: z.string().nullable(),
  name: z.string(),
  roles: z.array(z.string()),
  pagePath: z.string(),
  pageTitle: z.string(),
  body: z.string(),
  status,
  createdAt: z.string(),
  hasScreenshot: z.boolean(),
});
export const feedbackRouter = {
  get: withPermission('beta.feedback.review')
    .route({
      method: 'GET',
      path: '/beta-feedback/{id}',
      summary: 'Private beta report from email link',
    })
    .input(z.object({ id }))
    .output(report)
    .handler(({ input, context }) => {
      if (!context.permissionAccess.all)
        throw new ForbiddenError('Unrestricted feedback review is required');
      return getFeedback(context.db, input.id);
    }),
  context: withPermission('beta.feedback.submit')
    .route({
      method: 'GET',
      path: '/beta-feedback/context',
      summary: 'Reporter identity and screenshot limit',
    })
    .input(z.object({}).optional())
    .output(
      z.object({
        name: z.string(),
        ecode: z.string().nullable(),
        roles: z.array(z.string()),
        maxScreenshotBytes: z.number(),
      }),
    )
    .handler(async ({ context }) => ({
      ...(await feedbackIdentity(context.db, context.user.id)),
      maxScreenshotBytes: await screenshotLimit(context.db),
    })),
  submit: withPermission('beta.feedback.submit')
    .route({
      method: 'POST',
      path: '/beta-feedback',
      summary: 'Submit beta feedback with optional screenshot',
    })
    .input(
      z
        .object({
          requestId: z.string().uuid(),
          pagePath,
          pageTitle: z.string().trim().max(250),
          body: z.string().trim().min(1).max(5000),
          screenshot: z
            .object({
              mime: z.enum(['image/png', 'image/jpeg']),
              base64: z.string().min(4).max(8_000_000),
            })
            .optional(),
        })
        .strict(),
    )
    .output(z.object({ id: z.number() }))
    .handler(({ input, context }) =>
      submitFeedback(
        context.db,
        context.user.id,
        input,
        context.appBaseUrl ?? '',
        context.req.ip ?? null,
      ),
    ),
  list: withPermission('beta.feedback.review')
    .route({ method: 'GET', path: '/beta-feedback', summary: 'Private beta-feedback inbox' })
    .input(
      z.object({
        status: status.optional(),
        offset: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      }),
    )
    .output(z.object({ total: z.number(), rows: z.array(report) }))
    .handler(({ input, context }) => {
      if (!context.permissionAccess.all)
        throw new ForbiddenError('Unrestricted feedback review is required');
      return listFeedback(context.db, input);
    }),
  screenshot: withPermission('beta.feedback.submit')
    .route({
      method: 'GET',
      path: '/beta-feedback/{id}/screenshot',
      summary: 'Private screenshot for reporter or reviewer',
    })
    .input(z.object({ id }))
    .output(z.object({ mime: z.string(), base64: z.string() }))
    .handler(({ input, context }) => feedbackScreenshot(context.db, input.id, context.user.id)),
  review: withPermission('beta.feedback.review')
    .route({
      method: 'PATCH',
      path: '/beta-feedback/{id}',
      summary: 'Resolve or reopen beta feedback',
    })
    .input(z.object({ id, status }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(({ input, context }) => {
      if (!context.permissionAccess.all)
        throw new ForbiddenError('Unrestricted feedback review is required');
      return reviewFeedback(context.db, input.id, input.status, context.user.id);
    }),
};
