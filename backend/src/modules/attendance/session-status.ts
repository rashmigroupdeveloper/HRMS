/** ATT-05 / docs 09 §4: ordered session results are distinct from the daily summary. */
import { z } from 'zod';
import type { DayStatus } from '../../core/db/types.js';

const sessionCode = z.enum(['P', 'A', 'O']);
export const sessionStatusesSchema = z.tuple([
  z.object({ session: z.literal(1), status: sessionCode }),
  z.object({ session: z.literal(2), status: sessionCode }),
]);
export type SessionStatuses = z.infer<typeof sessionStatusesSchema>;

export function readSessionStatuses(raw: unknown): SessionStatuses | null {
  if (raw === null || raw === undefined) return null;
  return sessionStatusesSchema.parse(raw);
}

/** P/A summaries are deterministic; an off session retains HR's explicit daily
 * summary under the assigned policy, rather than inventing a payable fraction. */
export function validateSessionSummary(status: DayStatus, sessions: SessionStatuses | null): void {
  if (!sessions || sessions.some((s) => s.status === 'O')) return;
  const present = sessions.filter((s) => s.status === 'P').length;
  const expected = present === 2 ? 'P' : present === 1 ? 'HD' : 'A';
  if (status !== expected && !(expected === 'A' && status === 'UAB')) {
    throw new Error(`Session results require daily status ${expected}`);
  }
}

export function attendanceGlyph(status: string, raw: unknown, leaveCode?: string | null): string {
  const sessions = readSessionStatuses(raw);
  if (!sessions) return status === 'L' && leaveCode ? leaveCode : status;
  const [first, second] = sessions;
  return first.status === second.status ? first.status : `${first.status}:${second.status}`;
}
