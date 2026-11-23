# My attendance: design and motion review

Date: 23 November 2026. Local development, `hrms-new`.

Reference: `main:crextio-ref/crextio-011.webp` (desktop calendar) and
`main:crextio-ref/crextio-025.webp` (phone calendar). Screenshots were reviewed in the chat.

## Observations and fixes

- Reviewed the calendar at 1440 px and 390 px, including the cross-month attendance cycle,
  scheduled days, weekly offs, selected-day details, empty shift history and a pending regularization.
- Selected different working days and a weekly off; the day details and available actions changed.
- Found the moving selection outline could span multiple rows. Set explicit grid start/end lines;
  cancel selection movement on resize so old geometry is not retained after a viewport change.
- Removed the minimum artificial summary-bar width, so small nonzero counts retain their true relative size.
- Matched the punch skeleton to the charcoal day panel. Moved shared summary labels to `labels.ts`.
- In normal Safari mode, opened regularization, entered temporary review text and pressed Cancel.
  The discard question appeared; discarded the unsaved input. No request was submitted.
- Checked the delayed month skeleton through a temporary local proxy forwarding existing reads.
  Real dates, weekdays, summary labels and the dark day-panel structure remained visible.
  The proxy did not change application source or records.
- Added directional month transitions, selected-day crossfade, selection movement, request-form entrance,
  confirmation feedback and reduced-motion branches. Existing request confirmations and unsaved-input guards remain.
- Improved contrast of errors within the dark day panel and kept date-specific actions unavailable for locked months.

## Verification

- Typecheck, frontend lint, build, API tracker and data-access checks passed.
- Test suite: 31 files, 161 tests passed against the test database.
- Existing warnings: the organization `HodDialogs.tsx` Fast Refresh export warning,
  the build's large JavaScript chunk warning, and test dependency deprecation warnings.
- No backend API or schema changes in this design/motion slice.

## Limits

Safari responsive mode did not reliably map accessibility clicks to the rendered controls;
form discard behaviour was verified in normal mode. Browser control was interrupted during
the final loading-state viewport check. A complete held-loading comparison at both exact sizes,
reduced-motion playback and motion smoothness on a physical phone remain unverified.
The live demo employee has sparse punch data; no attendance data was manufactured for screenshots.
