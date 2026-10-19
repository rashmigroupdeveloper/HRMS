/**
 * Structured Multi-Question Pulse Surveys (EN-03, C34, docs/03 §9).
 *
 * Implements structured surveys with multiple questions (rating, choice, text),
 * targeted audience filtering, cryptographic salted HMAC anonymity guarantee,
 * single-response dedupe, and comprehensive analytical tallies.
 */
import { createHmac } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { z } from 'zod';
import { parseJsonValue } from '../../core/json.js';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import {
  audienceIncludesUser,
  toAudience,
  type Db,
  type EngagementAudience,
} from './audience.js';
import { surveyRecommendations } from './survey-recommendations.js';

export interface SurveyQuestion {
  id: string;
  prompt: string;
  type: 'rating' | 'choice' | 'text';
  options?: string[] | undefined;
  required?: boolean | undefined;
}

export interface SurveyAnswer {
  questionId: string;
  answer: string | number;
}

export interface SurveyRow {
  id: number;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  isAnonymous: boolean;
  openFrom: string;
  openTill: string | null;
  isActive: boolean;
  hasResponded: boolean;
}

export interface SurveyQuestionResult {
  questionId: string;
  prompt: string;
  type: 'rating' | 'choice' | 'text';
  totalAnswers: number;
  avgRating?: number | null | undefined;
  ratingDistribution?: Record<number, number> | undefined;
  choiceDistribution?: Record<string, number> | undefined;
  textAnswers?: { answer: string; byEmail: string | null }[] | undefined;
}

export interface SurveyResultRow {
  surveyId: number;
  title: string;
  description: string | null;
  isAnonymous: boolean;
  totalResponses: number;
  questions: SurveyQuestionResult[];
  recommendations: string[];
}

function surveyAnonymousHash(appSecret: string, surveyId: number, userId: number): string {
  return createHmac('sha256', appSecret).update(`eng.survey:${surveyId}:${userId}`).digest('hex');
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

const questionsSchema = z.array(z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  type: z.enum(['rating', 'choice', 'text']),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(true),
})).min(1);

const answersSchema = z.array(z.object({
  questionId: z.string().min(1),
  answer: z.union([z.string(), z.number()]),
})).min(1);

function parseQuestions(value: unknown): SurveyQuestion[] {
  return questionsSchema.parse(parseJsonValue(value));
}

export interface CreateSurveyParams {
  title: string;
  description?: string | undefined;
  questions: SurveyQuestion[];
  isAnonymous: boolean;
  audience?: EngagementAudience | undefined;
  openTill?: string | undefined;
  actorUserId: number;
}

export async function createSurvey(
  db: Kysely<Database>,
  params: CreateSurveyParams,
): Promise<number> {
  if (params.questions.length === 0) {
    throw new Error('A survey must contain at least one question');
  }

  for (const q of params.questions) {
    if (!q.id || !q.prompt) {
      throw new Error('Each question must have an id and prompt');
    }
    if (q.type === 'choice' && (!q.options || q.options.length < 2)) {
      throw new Error(`Choice question "${q.prompt}" must have at least 2 options`);
    }
  }

  const row = await db
    .insertInto('eng.surveys')
    .values({
      title: params.title,
      description: params.description ?? null,
      questions: JSON.stringify(params.questions),
      is_anonymous: params.isAnonymous,
      audience: JSON.stringify(params.audience ?? {}),
      created_by: params.actorUserId,
      open_till: params.openTill === undefined ? null : sql<Date>`${params.openTill}::timestamptz`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'create',
    entity: 'eng.surveys',
    entityId: row.id,
    field: 'title',
    newValue: `${params.isAnonymous ? 'anonymous' : 'named'}: ${params.title}`,
  });

  return row.id;
}

export async function listSurveysForUser(
  db: Db,
  userId: number,
  appSecret: string,
): Promise<SurveyRow[]> {
  const rows = await db
    .selectFrom('eng.surveys')
    .selectAll()
    .where('is_active', '=', true)
    .where(sql<boolean>`open_from <= now()`)
    .where(sql<boolean>`(open_till IS NULL OR open_till > now())`)
    .orderBy('open_from', 'desc')
    .execute();

  const visible: SurveyRow[] = [];
  for (const r of rows) {
    const surveyId = r.id;
    if (!(await audienceIncludesUser(db, toAudience(r.audience), userId))) continue;
    const responded = await hasRespondedSurvey(db, surveyId, userId, r.is_anonymous, appSecret);
    visible.push({
      id: surveyId,
      title: r.title,
      description: r.description,
      questions: parseQuestions(r.questions),
      isAnonymous: r.is_anonymous,
      openFrom: iso(r.open_from) ?? '',
      openTill: iso(r.open_till),
      isActive: r.is_active,
      hasResponded: responded,
    });
  }
  return visible;
}

export async function listAllSurveys(db: Db): Promise<SurveyRow[]> {
  const rows = await db
    .selectFrom('eng.surveys')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    questions: parseQuestions(r.questions),
    isAnonymous: r.is_anonymous,
    openFrom: iso(r.open_from) ?? '',
    openTill: iso(r.open_till),
    isActive: r.is_active,
    hasResponded: false,
  }));
}

async function hasRespondedSurvey(
  db: Db,
  surveyId: number,
  userId: number,
  isAnonymous: boolean,
  appSecret: string,
): Promise<boolean> {
  const q = db.selectFrom('eng.survey_responses').select('id').where('survey_id', '=', surveyId);
  const hit = isAnonymous
    ? await q
        .where('respondent_hash', '=', surveyAnonymousHash(appSecret, surveyId, userId))
        .executeTakeFirst()
    : await q.where('respondent_user_id', '=', userId).executeTakeFirst();
  return hit !== undefined;
}

export interface RespondToSurveyParams {
  surveyId: number;
  userId: number;
  answers: SurveyAnswer[];
  appSecret: string;
}

export async function respondToSurvey(
  db: Kysely<Database>,
  params: RespondToSurveyParams,
): Promise<void> {
  const survey = await db
    .selectFrom('eng.surveys')
    .selectAll()
    .where('id', '=', params.surveyId)
    .executeTakeFirst();
  if (survey === undefined) throw new Error('Survey not found');
  if (!survey.is_active) throw new Error('This survey is closed');
  if (survey.open_till !== null && new Date(survey.open_till).getTime() <= Date.now()) {
    throw new Error('This survey has expired');
  }
  if (new Date(survey.open_from).getTime() > Date.now()) {
    throw new Error('This survey is not open yet');
  }

  if (!(await audienceIncludesUser(db, toAudience(survey.audience), params.userId))) {
    throw new Error('This survey is not addressed to you');
  }

  const questions = parseQuestions(survey.questions);
  for (const q of questions) {
    if (q.required) {
      const ans = params.answers.find((a) => a.questionId === q.id);
      if (ans === undefined || ans.answer === '') {
        throw new Error(`Question "${q.prompt}" is required`);
      }
    }
  }

  try {
    await db
      .insertInto('eng.survey_responses')
      .values({
        survey_id: params.surveyId,
        respondent_user_id: survey.is_anonymous ? null : params.userId,
        respondent_hash: survey.is_anonymous
          ? surveyAnonymousHash(params.appSecret, params.surveyId, params.userId)
          : null,
        answers: JSON.stringify(params.answers),
      })
      .execute();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('survey_responses_one_per')) {
      throw new Error('You have already submitted a response for this survey');
    }
    throw err;
  }
}

export async function surveyResults(db: Db, surveyId: number): Promise<SurveyResultRow> {
  const survey = await db
    .selectFrom('eng.surveys')
    .selectAll()
    .where('id', '=', surveyId)
    .executeTakeFirst();
  if (survey === undefined) throw new Error('Survey not found');

  const questions = parseQuestions(survey.questions);

  const responses = await db
    .selectFrom('eng.survey_responses as r')
    .leftJoin('core.users as u', 'u.id', 'r.respondent_user_id')
    .select(['r.answers', 'u.email as respondent_email'])
    .where('r.survey_id', '=', surveyId)
    .execute();

  const totalResponses = responses.length;
  const decodedResponses = responses.map(r => ({
    answers: answersSchema.parse(parseJsonValue(r.answers)),
    byEmail: survey.is_anonymous ? null : r.respondent_email,
  }));

  const questionResults: SurveyQuestionResult[] = questions.map((q) => {
    const rawAnswers = decodedResponses
      .map((r) => {
        const item = r.answers.find((a) => a.questionId === q.id);
        return item
          ? {
              answer: item.answer,
              byEmail: r.byEmail,
            }
          : null;
      })
      .filter((a): a is { answer: string | number; byEmail: string | null } => a !== null);

    const totalAnswers = rawAnswers.length;

    if (q.type === 'rating') {
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      let count = 0;
      for (const a of rawAnswers) {
        const val = Number(a.answer);
        if (val >= 1 && val <= 5) {
          dist[val] = (dist[val] ?? 0) + 1;
          sum += val;
          count++;
        }
      }
      return {
        questionId: q.id,
        prompt: q.prompt,
        type: 'rating',
        totalAnswers,
        avgRating: count === 0 ? null : Math.round((sum / count) * 10) / 10,
        ratingDistribution: dist,
      };
    }

    if (q.type === 'choice') {
      const dist: Record<string, number> = {};
      for (const opt of q.options ?? []) {
        dist[opt] = 0;
      }
      for (const a of rawAnswers) {
        const opt = String(a.answer);
        dist[opt] = (dist[opt] ?? 0) + 1;
      }
      return {
        questionId: q.id,
        prompt: q.prompt,
        type: 'choice',
        totalAnswers,
        choiceDistribution: dist,
      };
    }

    // Freeform text
    return {
      questionId: q.id,
      prompt: q.prompt,
      type: 'text',
      totalAnswers,
      textAnswers: rawAnswers.map((a) => ({
        answer: String(a.answer),
        byEmail: a.byEmail,
      })),
    };
  });

  return {
    surveyId,
    title: survey.title,
    description: survey.description,
    isAnonymous: survey.is_anonymous,
    totalResponses,
    questions: questionResults,
    recommendations: surveyRecommendations(questionResults),
  };
}

export async function closeSurvey(
  db: Kysely<Database>,
  surveyId: number,
  actorUserId: number,
): Promise<void> {
  const updated = await db
    .updateTable('eng.surveys')
    .set({ is_active: false })
    .where('id', '=', surveyId)
    .returning('id')
    .executeTakeFirst();
  if (updated === undefined) throw new Error('Survey not found');

  await writeAudit(db, {
    actorUserId,
    action: 'update',
    entity: 'eng.surveys',
    entityId: surveyId,
    field: 'is_active',
    oldValue: 'true',
    newValue: 'false',
  });
}
