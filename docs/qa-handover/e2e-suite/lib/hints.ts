/** Fixer-facing hints for known failure signatures (matched against test title + error). Keep short and concrete. */
export const HINTS: { match: RegExp; area: string; hint: string }[] = [
  { match: /resign|E18|M10|301/i, area: 'Lifecycle / separation', hint: 'ESS resignation form posts a hard-coded employee id (301) → 403 for everyone. Use the signed-in user\'s employee id (`/api/auth/me`), never a constant; backend should derive it for self-service.' },
  { match: /needs a budget/i, area: 'Claims', hint: 'Claim submit fails with "This claim needs a budget": no budget row for the cohort\'s cost centre/category. Either seed budgets for every active category or let claims without a budget route with an "over budget" flag (RQ-TE-004 says flag, not block).' },
  { match: /AUTH-05|change password/i, area: 'Auth', hint: 'No "Change password" entry in the Account menu. API /api/auth/change-password works; add a drawer with current/new/confirm and the policy text.' },
  { match: /AUTH-06|forgot/i, area: 'Auth', hint: 'Forgot password is a mailto: link. API /api/auth/forgot-password + /reset-password work; add the request form and a /reset-password?token= page.' },
  { match: /AUTH-07|temporary password|unlock/i, area: 'Admin / users', hint: 'Users & Roles has no Unlock / Reset password actions. APIs /api/auth/users/{id}/unlock and temp-password exist; add row actions (it_admin, super_admin).' },
  { match: /directory|EMP-06|E-DIR/i, area: 'People', hint: 'Employee directory returns 0 colleagues for employees (scope O). Docs/08 gives employees a basic directory (name, dept, work email); return the public subset.' },
  { match: /NEG-UI/i, area: 'RBAC (UI)', hint: 'A forbidden page renders its shell and action buttons. Gate the route with the same permission the API checks (RequirePermission) and hide action buttons when the permission is absent.' },
  { match: /payroll settings|\/payroll\/settings|P8 /i, area: 'Payroll config', hint: '"Payroll settings" link goes to /payroll/settings, which is not a route (bounces to /). Add the page on top of /api/payroll/config/{statutory-rates,pt-slabs,gl-accounts}.' },
  { match: /reopened run accepts variable inputs|P4r/i, area: 'Payroll run', hint: 'UI treats "reopened" as draft (isDraft) and offers the inputs form, but config.service.ts:149 only accepts status === "draft". Either allow reopened in the service or hide the form until "Back to draft".' },
  { match: /label-content-name-mismatch/i, area: 'Accessibility', hint: 'Buttons whose aria-label does not contain their visible text (WCAG 2.5.3). Make aria-label start with the visible text or drop it.' },
  { match: /color-contrast/i, area: 'Accessibility', hint: 'Text below 4.5:1 contrast (muted ink on tinted surfaces). Darken text-ink-muted / pill text tokens.' },
  { match: /horizontal scrolling/i, area: 'Responsive', hint: 'Page wider than the viewport on tablet/mobile; wrap wide tables in overflow-x-auto containers.' },
];
export function hintFor(text: string) { return HINTS.find((h) => h.match.test(text)); }
