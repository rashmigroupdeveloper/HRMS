/** BETA-01: identity is server-owned; screenshots are private registry documents. */
import type { Kysely } from 'kysely';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { inTransaction } from '../../core/db/database.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { DomainError, ForbiddenError, NotFoundError } from '../../core/errors/index.js';
import { getUserRoleCodes, getUserPermissionAccess } from '../../core/rbac/permissions.service.js';
import { createDocument, readDocument } from '../../core/storage/index.js';
import { enqueueEvent } from '../notifications/index.js';
import { getTypedSetting } from '../settings/index.js';

export interface FeedbackInput {
  requestId: string;
  pagePath: string;
  pageTitle: string;
  body: string;
  screenshot?: { mime: 'image/png' | 'image/jpeg'; base64: string } | undefined;
}
export async function feedbackIdentity(db: Kysely<Database>, userId: number) {
  const user = await db
    .selectFrom('core.users as u')
    .leftJoin('core.employees as e', 'e.id', 'u.employee_id')
    .select(['u.email', 'e.ecode', 'e.first_name', 'e.last_name'])
    .where('u.id', '=', userId)
    .executeTakeFirstOrThrow();
  return {
    name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
    ecode: user.ecode,
    roles: [...(await getUserRoleCodes(db, userId))].sort(),
  };
}
export async function screenshotLimit(db: Kysely<Database>) {
  const limit = await getTypedSetting(
    db,
    'beta.feedback.max_screenshot_bytes',
    'number',
    3_000_000,
  );
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 6_000_000)
    throw new DomainError('Screenshot upload limit is not configured correctly');
  return limit;
}
export function screenshotBytes(
  input: NonNullable<FeedbackInput['screenshot']>,
  limit: number,
): Buffer {
  const bytes = Buffer.from(input.base64, 'base64');
  if (!bytes.length || bytes.length > limit || bytes.toString('base64') !== input.base64)
    throw new DomainError('Choose a valid screenshot within the upload size limit');
  const signature =
    input.mime === 'image/png'
      ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
      : bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
  if (!signature) throw new DomainError('Screenshot contents do not match the image type');
  return bytes;
}
export async function submitFeedback(
  db: Kysely<Database>,
  userId: number,
  input: FeedbackInput,
  appBaseUrl: string,
  ip: string | null,
) {
  return inTransaction(db, async (tx) => {
    // A retry after a lost response must not create a second report, file or email.
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestId}, 0))`.execute(tx);
    const existing = await tx
      .selectFrom('hd.beta_feedback')
      .select(['id', 'user_id', 'page_path', 'page_title', 'body', 'screenshot_document_id'])
      .where('request_id', '=', input.requestId)
      .executeTakeFirst();
    if (existing) {
      if (existing.user_id !== userId)
        throw new ForbiddenError('This report identifier is already in use');
      if (
        existing.page_path !== input.pagePath ||
        existing.page_title !== input.pageTitle ||
        existing.body !== input.body.trim() ||
        (existing.screenshot_document_id !== null) !== Boolean(input.screenshot)
      ) {
        throw new DomainError('This report identifier belongs to a different draft');
      }
      if (input.screenshot && existing.screenshot_document_id !== null) {
        const doc = await tx
          .selectFrom('core.documents')
          .select('sha256')
          .where('id', '=', existing.screenshot_document_id)
          .executeTakeFirstOrThrow();
        const digest = createHash('sha256')
          .update(screenshotBytes(input.screenshot, await screenshotLimit(tx)))
          .digest('hex');
        if (digest !== doc.sha256)
          throw new DomainError('This report identifier belongs to a different screenshot');
      }
      return { id: existing.id };
    }
    const identity = await feedbackIdentity(tx, userId);
    const bytes = input.screenshot
      ? screenshotBytes(input.screenshot, await screenshotLimit(tx))
      : null;
    const documentId =
      bytes && input.screenshot
        ? await createDocument(tx, {
            ownerEmployeeId: null,
            kind: 'beta_feedback',
            originalName:
              input.screenshot.mime === 'image/png' ? 'screenshot.png' : 'screenshot.jpg',
            mime: input.screenshot.mime,
            content: bytes,
            uploadedBy: userId,
          })
        : null;
    const row = await tx
      .insertInto('hd.beta_feedback')
      .values({
        request_id: input.requestId,
        user_id: userId,
        employee_code: identity.ecode,
        user_name: identity.name,
        role_codes: JSON.stringify(identity.roles),
        page_path: input.pagePath,
        page_title: input.pageTitle,
        body: input.body.trim(),
        screenshot_document_id: documentId,
        reviewed_by: null,
        reviewed_at: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await enqueueEvent(tx, 'beta.feedback.submitted', 'beta_feedback', {
      reportId: row.id,
      name: identity.name,
      employeeId: identity.ecode,
      roles: identity.roles.join(', '),
      page: input.pagePath,
      pageTitle: input.pageTitle,
      feedback: input.body.trim(),
      screenshot: documentId ? 'Attached in the private inbox' : 'Not attached',
      inbox: `${appBaseUrl.replace(/\/$/, '')}/admin/beta-feedback?report=${String(row.id)}`,
    });
    await writeAudit(tx, {
      actorUserId: userId,
      action: 'create',
      entity: 'hd.beta_feedback',
      entityId: row.id,
      newValue: 'Beta feedback submitted',
      ip,
    });
    return { id: row.id };
  });
}
export async function listFeedback(
  db: Kysely<Database>,
  filter: { status?: 'new' | 'resolved' | undefined; offset: number; limit: number },
) {
  let query = db.selectFrom('hd.beta_feedback');
  if (filter.status !== undefined) query = query.where('status', '=', filter.status);
  const [rows, total] = await Promise.all([
    query
      .select([
        'id',
        'employee_code',
        'user_name',
        'role_codes',
        'page_path',
        'page_title',
        'body',
        'status',
        'created_at',
        'screenshot_document_id',
      ])
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .offset(filter.offset)
      .limit(filter.limit)
      .execute(),
    query.select(db.fn.countAll<number>().as('n')).executeTakeFirstOrThrow(),
  ]);
  return {
    total: total.n,
    rows: rows.map((r) => ({
      id: r.id,
      ecode: r.employee_code,
      name: r.user_name,
      roles: r.role_codes,
      pagePath: r.page_path,
      pageTitle: r.page_title,
      body: r.body,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      hasScreenshot: r.screenshot_document_id !== null,
    })),
  };
}
export async function getFeedback(db: Kysely<Database>, id: number) {
  const r = await db
    .selectFrom('hd.beta_feedback')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (!r) throw new NotFoundError('Feedback not found');
  return {
    id: r.id,
    ecode: r.employee_code,
    name: r.user_name,
    roles: r.role_codes,
    pagePath: r.page_path,
    pageTitle: r.page_title,
    body: r.body,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    hasScreenshot: r.screenshot_document_id !== null,
  };
}
export async function feedbackScreenshot(db: Kysely<Database>, id: number, userId: number) {
  const row = await db
    .selectFrom('hd.beta_feedback')
    .select(['user_id', 'screenshot_document_id'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (!row) throw new NotFoundError('Feedback not found');
  if (
    row.user_id !== userId &&
    !(await getUserPermissionAccess(db, userId, 'beta.feedback.review'))?.all
  )
    throw new ForbiddenError('This screenshot is private');
  if (row.screenshot_document_id === null) throw new NotFoundError('No screenshot attached');
  await writeAudit(db, {
    actorUserId: userId,
    action: 'read',
    entity: 'hd.beta_feedback',
    entityId: id,
    newValue: 'Feedback screenshot opened',
  });
  const file = await readDocument(db, row.screenshot_document_id);
  return { mime: file.mime, base64: file.content.toString('base64') };
}
export async function reviewFeedback(
  db: Kysely<Database>,
  id: number,
  status: 'new' | 'resolved',
  userId: number,
) {
  return inTransaction(db, async (tx) => {
    const result = await tx
      .updateTable('hd.beta_feedback')
      .set({ status, reviewed_by: userId, reviewed_at: new Date() })
      .where('id', '=', id)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) throw new NotFoundError('Feedback not found');
    await writeAudit(tx, {
      actorUserId: userId,
      action: 'update',
      entity: 'hd.beta_feedback',
      entityId: id,
      field: 'status',
      newValue: status,
    });
    return { ok: true as const };
  });
}
