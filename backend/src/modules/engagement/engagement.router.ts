/**
 * Engagement API (M10 — EN-01/02/03).
 *
 * Permission tiers, deliberately:
 *   - READING your feed and ANSWERING a poll addressed to you is `authed`.
 *     Gating "hear from the company" behind a permission would mean the people
 *     most likely to be mis-provisioned are the ones who never hear anything.
 *   - PUBLISHING (announcements, polls) and reading RESULTS needs
 *     `engagement.publish` (docs/08 §2).
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, withPermission } from '../../api/orpc.js';
import {
  listAllAnnouncements,
  listAnnouncementsForUser,
  publishAnnouncement,
  withdrawAnnouncement,
} from './announcements.service.js';
import {
  closePoll,
  createPoll,
  listPollsForUser,
  pollResults,
  respondToPoll,
} from './polls.service.js';

const publisher = () => withPermission('engagement.publish');

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', {
    message: err instanceof Error ? err.message : 'Invalid request',
  });
}

const audienceShape = z
  .object({
    categories: z.array(z.enum(['white_collar', 'blue_collar', 'contract', 'trainee'])).optional(),
    departmentIds: z.array(z.number().int().positive()).optional(),
    locationIds: z.array(z.number().int().positive()).optional(),
  })
  .optional();

const announcementShape = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string(),
  publishedAt: z.string(),
  expiresAt: z.string().nullable(),
  isActive: z.boolean(),
  publishedByEmail: z.string().nullable(),
});

const pollShape = z.object({
  id: z.number(),
  question: z.string(),
  options: z.array(z.string()),
  kind: z.enum(['poll', 'pulse']),
  isAnonymous: z.boolean(),
  opensAt: z.string(),
  closesAt: z.string().nullable(),
  isActive: z.boolean(),
  hasResponded: z.boolean(),
});

const resultShape = z.object({
  pollId: z.number(),
  question: z.string(),
  isAnonymous: z.boolean(),
  totalResponses: z.number(),
  options: z.array(z.object({ index: z.number(), label: z.string(), votes: z.number() })),
  comments: z.array(z.object({ comment: z.string(), byEmail: z.string().nullable() })),
});

// ── Announcements ───────────────────────────────────────────────────────────

/** The ESS feed — only what is live and addressed to the caller. */
const myAnnouncements = authed
  .route({
    method: 'GET',
    path: '/engagement/announcements',
    summary: 'EN-01 announcements addressed to me',
  })
  .output(z.array(announcementShape))
  .handler(({ context }) => listAnnouncementsForUser(context.db, context.user.id));

const allAnnouncements = publisher()
  .route({
    method: 'GET',
    path: '/engagement/announcements/all',
    summary: 'EN-01 publisher view — includes expired and withdrawn',
  })
  .output(z.array(announcementShape))
  .handler(({ context }) => listAllAnnouncements(context.db));

const publish = publisher()
  .route({ method: 'POST', path: '/engagement/announcements', summary: 'EN-01 publish' })
  .input(
    z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1),
      audience: audienceShape,
      expiresAt: z.string().datetime().optional(),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      const id = await publishAnnouncement(context.db, {
        ...input,
        actorUserId: context.user.id,
      });
      return { id };
    } catch (err: unknown) {
      return asBadRequest(err);
    }
  });

const withdraw = publisher()
  .route({
    method: 'POST',
    path: '/engagement/announcements/{id}/withdraw',
    summary: 'EN-01 withdraw (never a delete)',
  })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    try {
      await withdrawAnnouncement(context.db, input.id, context.user.id);
      return { ok: true };
    } catch (err: unknown) {
      return asBadRequest(err);
    }
  });

// ── Polls and pulse checks ──────────────────────────────────────────────────

const myPolls = authed
  .route({ method: 'GET', path: '/engagement/polls', summary: 'EN-02/03 polls open to me' })
  .output(z.array(pollShape))
  .handler(({ context }) => listPollsForUser(context.db, context.user.id, context.jwtSecret));

const create = publisher()
  .route({ method: 'POST', path: '/engagement/polls', summary: 'EN-02/03 create a poll or pulse' })
  .input(
    z.object({
      question: z.string().min(1).max(300),
      options: z.array(z.string().min(1)).min(2).max(10),
      kind: z.enum(['poll', 'pulse']).optional(),
      // Anonymity is fixed here and enforced by a DB CHECK — there is
      // deliberately no endpoint that can change it later.
      isAnonymous: z.boolean(),
      audience: audienceShape,
      closesAt: z.string().datetime().optional(),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      const id = await createPoll(context.db, { ...input, actorUserId: context.user.id });
      return { id };
    } catch (err: unknown) {
      return asBadRequest(err);
    }
  });

const respond = authed
  .route({ method: 'POST', path: '/engagement/polls/{id}/respond', summary: 'EN-02/03 respond' })
  .input(
    z.object({
      id: z.coerce.number().int().positive(),
      optionIndex: z.number().int().min(0),
      comment: z.string().max(2000).optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    try {
      await respondToPoll(context.db, {
        pollId: input.id,
        userId: context.user.id,
        optionIndex: input.optionIndex,
        comment: input.comment,
        appSecret: context.jwtSecret,
      });
      return { ok: true };
    } catch (err: unknown) {
      return asBadRequest(err);
    }
  });

const results = publisher()
  .route({ method: 'GET', path: '/engagement/polls/{id}/results', summary: 'EN-02/03 tally' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(resultShape)
  .handler(async ({ input, context }) => {
    try {
      return await pollResults(context.db, input.id);
    } catch (err: unknown) {
      return asBadRequest(err);
    }
  });

const close = publisher()
  .route({ method: 'POST', path: '/engagement/polls/{id}/close', summary: 'EN-02/03 close a poll' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    try {
      await closePoll(context.db, input.id, context.user.id);
      return { ok: true };
    } catch (err: unknown) {
      return asBadRequest(err);
    }
  });

export const engagementRouter = {
  myAnnouncements,
  allAnnouncements,
  publish,
  withdraw,
  myPolls,
  create,
  respond,
  results,
  close,
};
