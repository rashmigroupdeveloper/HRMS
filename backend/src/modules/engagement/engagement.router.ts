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
import {
  closeSurvey,
  createSurvey,
  listAllSurveys,
  listSurveysForUser,
  respondToSurvey,
  surveyResults,
} from './surveys.service.js';

const publisher = () => withPermission('engagement.publish');

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', {
    message: err instanceof Error ? err.message : 'Invalid request',
  });
}

const audienceShape = z
  .object({
    companyIds: z.array(z.number().int().positive()).optional(),
    categories: z.array(z.enum(['white_collar', 'blue_collar', 'contract', 'trainee'])).optional(),
    departmentIds: z.array(z.number().int().positive()).optional(),
    locationIds: z.array(z.number().int().positive()).optional(),
  })
  .optional();

const announcementShape = z.object({
  id: z.coerce.number(),
  title: z.string(),
  body: z.string(),
  attachmentDocumentId: z.coerce.number().nullable().optional(),
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
      attachmentDocumentId: z.number().int().positive().nullish(),
      audience: audienceShape,
      expiresAt: z.string().datetime().optional(),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      const id = await publishAnnouncement(context.db, {
        title: input.title,
        body: input.body,
        attachmentDocumentId: input.attachmentDocumentId ?? null,
        audience: input.audience,
        expiresAt: input.expiresAt,
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

// ── Structured Multi-Question Surveys (EN-03, C34) ──────────────────────────

const surveyQuestionInputShape = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1).max(500),
  type: z.enum(['rating', 'choice', 'text']),
  options: z.array(z.string().min(1)).optional(),
  required: z.boolean().optional(),
});

const surveyQuestionOutputShape = z.object({
  id: z.string(),
  prompt: z.string(),
  type: z.enum(['rating', 'choice', 'text']),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const surveyShape = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  questions: z.array(surveyQuestionOutputShape),
  isAnonymous: z.boolean(),
  openFrom: z.string(),
  openTill: z.string().nullable(),
  isActive: z.boolean(),
  hasResponded: z.boolean(),
});

const surveyAnswerInputShape = z.object({
  questionId: z.string().min(1),
  answer: z.union([z.string(), z.number()]),
});

const surveyQuestionResultShape = z.object({
  questionId: z.string(),
  prompt: z.string(),
  type: z.enum(['rating', 'choice', 'text']),
  totalAnswers: z.number(),
  avgRating: z.number().nullable().optional(),
  ratingDistribution: z.record(z.string(), z.number()).optional(),
  choiceDistribution: z.record(z.string(), z.number()).optional(),
  textAnswers: z.array(z.object({ answer: z.string(), byEmail: z.string().nullable() })).optional(),
});

const surveyResultShape = z.object({
  surveyId: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  isAnonymous: z.boolean(),
  totalResponses: z.number(),
  questions: z.array(surveyQuestionResultShape),
  recommendations: z.array(z.string()),
});

const mySurveys = authed
  .route({ method: 'GET', path: '/engagement/surveys', summary: 'EN-03 surveys addressed to me' })
  .output(z.array(surveyShape))
  .handler(({ context }) => listSurveysForUser(context.db, context.user.id, context.jwtSecret));

const allSurveys = publisher()
  .route({ method: 'GET', path: '/engagement/surveys/all', summary: 'EN-03 all surveys (publisher view)' })
  .output(z.array(surveyShape))
  .handler(({ context }) => listAllSurveys(context.db));

const createSurveyRoute = publisher()
  .route({ method: 'POST', path: '/engagement/surveys', summary: 'EN-03 create multi-question survey' })
  .input(
    z.object({
      title: z.string().min(1).max(300),
      description: z.string().max(2000).optional(),
      questions: z.array(surveyQuestionInputShape).min(1).max(30),
      isAnonymous: z.boolean(),
      audience: audienceShape,
      openTill: z.string().datetime().optional(),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      const id = await createSurvey(context.db, {
        title: input.title,
        description: input.description,
        questions: input.questions,
        isAnonymous: input.isAnonymous,
        audience: input.audience,
        openTill: input.openTill,
        actorUserId: context.user.id,
      });
      return { id };
    } catch (err: unknown) {
      return asBadRequest(err);
    }
  });

const respondSurvey = authed
  .route({ method: 'POST', path: '/engagement/surveys/{id}/respond', summary: 'EN-03 submit survey response' })
  .input(
    z.object({
      id: z.coerce.number().int().positive(),
      answers: z.array(surveyAnswerInputShape).min(1),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    try {
      await respondToSurvey(context.db, {
        surveyId: input.id,
        userId: context.user.id,
        answers: input.answers,
        appSecret: context.jwtSecret,
      });
      return { ok: true };
    } catch (err: unknown) {
      return asBadRequest(err);
    }
  });

const surveyResultsRoute = publisher()
  .route({ method: 'GET', path: '/engagement/surveys/{id}/results', summary: 'EN-03 survey results and tally' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(surveyResultShape)
  .handler(async ({ input, context }) => {
    try {
      return await surveyResults(context.db, input.id);
    } catch (err: unknown) {
      return asBadRequest(err);
    }
  });

const closeSurveyRoute = publisher()
  .route({ method: 'POST', path: '/engagement/surveys/{id}/close', summary: 'EN-03 close a survey' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    try {
      await closeSurvey(context.db, input.id, context.user.id);
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
  mySurveys,
  allSurveys,
  createSurvey: createSurveyRoute,
  respondSurvey,
  surveyResults: surveyResultsRoute,
  closeSurvey: closeSurveyRoute,
};
