import { z } from 'zod'

// The security rules HR / IT can change (2026-11-16): every rule within sensible bounds.
export const updateSecurityRulesInput = z.object({
  // wrong passwords in a row before the login is locked
  maxFailedLogins: z.number().int().min(3).max(20),
  // how long the lock lasts
  lockMinutes: z.number().int().min(1).max(1440),
  // how long a sign-in lasts, from signing in (1 hour - 30 days)
  sessionHours: z.number().int().min(1).max(720),
  minPasswordLength: z.number().int().min(8).max(64),
  // a new password may not be one of the last N (the one in use counts)
  passwordHistory: z.number().int().min(1).max(24),
  // how long a "forgot password" code works
  resetCodeMinutes: z.number().int().min(5).max(60),
  // how long re-entering the password counts before changing roles
  confirmPasswordMinutes: z.number().int().min(1).max(60),
})
