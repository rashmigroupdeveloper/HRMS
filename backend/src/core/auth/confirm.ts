import { ORPCError } from '@orpc/server'

// Re-entering one's password before a sensitive change (old HRMS "step-up", decided 2026-11-16: changing roles and who
// has them). accounts.confirmPassword marks the session confirmed for CONFIRM_MINUTES; until then no new prompt.

export const CONFIRM_MINUTES = 10

// Throws 403 with data.passwordConfirmationRequired unless the password was re-entered in this session recently
export function assertPasswordConfirmed(user: { passwordConfirmedUntil: Date | null }) {
  if (!user.passwordConfirmedUntil || user.passwordConfirmedUntil <= new Date()) {
    throw new ORPCError('FORBIDDEN', { message: 'Enter your password to confirm this change', data: { passwordConfirmationRequired: true } })
  }
}
