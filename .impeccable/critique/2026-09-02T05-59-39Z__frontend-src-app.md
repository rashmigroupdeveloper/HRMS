---
target: ESS + all role pages vs Crextio shell/motion
total_score: 22
p0_count: 2
p1_count: 3
timestamp: 2026-09-02T05-59-39Z
slug: frontend-src-app
---
# Crextio shell / motion / role-homes critique

Target: frontend/src/app + role landings. Login inspected live at http://localhost:5173/. Authenticated role homes reviewed from source (no session).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Inbox badge and SLA exist; sticky title does not show today's job |
| 2 | Match System / Real World | 2 | UAB, watermark, ledger, Phase 2 backend on employee-facing copy |
| 3 | User Control and Freedom | 2 | Drawers/Esc exist; approvals have no undo; rail collapse is unused control |
| 4 | Consistency and Standards | 1 | Pill-nav spec vs left rail; serif-once vs serif-everywhere; gold-fill vs left stripe |
| 5 | Error Prevention | 3 | Typed confirm reserved; reject requires a note; login validates on blur |
| 6 | Recognition Rather Than Recall | 2 | No Requests home; native title= tooltips; Travel sits next to punch-in |
| 7 | Flexibility and Efficiency | 3 | ⌘K and a/r exist for ops; ESS has no 2-click daily path from Home |
| 8 | Aesthetic and Minimalist Design | 1 | Calm tokens, maximal chrome: rail + blur bar + serif h1 + KPIs + cards |
| 9 | Error Recovery | 3 | Retry on dashboard/payslip; login names the fix |
| 10 | Help and Documentation | 2 | Consequence copy is good; For the build team must never ship to Rachna |
| **Total** | | **22/40** | **Acceptable** |

## Anti-Patterns Verdict

**Does this look AI-generated?** The tokens do not. The chrome does: left admin rail, tracked uppercase eyebrows, Fraunces on every title, identical PendingModule manifesto cards.

**LLM assessment:** Warm Editorial paint on a greytHR skeleton. Crextio's signature is the center pill nav and large light-weight geometric greeting. Shipped product is a collapsible sidebar with ceremonial serif.

**Deterministic scan:** 1 CLI finding (`side-tab` / `border-l-4` on ApprovalsPage.tsx:208). In-page detect.js on login: 6 hits (eyebrow kicker, 4.4:1 muted ink, cream-palette, width transition in bundled CSS, repeating-gradient from hatch utilities). cream-palette is a false positive against this brand. side-tab is a real spec ban even though the element is a list row.

**Visual overlays:** Injection succeeded on login in Assessment B's tab. Authenticated shell was unreachable (refresh 401).

## Overall Impression

The kit in `frontend/src/ui` is ahead of the shell. Until the masthead is a top pill, serif is a welcome, and today's job is one gold control, "premium Warm Editorial" is a token file, not a product.

## What's Working

1. Token and primitive craft: canvas glow, charcoal grain, 24px cards, hatch, 4-state pills, tabular IN numerals, hover gated for coarse pointers.
2. Honesty about missing money and Phase 4 contract column.
3. Job-switching gold on ESS/HR (one accent meaning "this") when it is not fighting a gold stripe.

## Priority Issues

- **[P0] Left rail instead of Crextio pill nav.** AppShell.tsx / Sidebar.tsx / nav-config.ts. Fix: masthead + 5-8 role-filtered pills, kill collapse and duplicate sticky title. Suggested: /impeccable shape then layout.
- **[P0] Fraunces on every PageHeader.** Spec: serif welcome once. Fix: Manrope extra-light in-app; Fraunces only on Hello {name}. Suggested: /impeccable typeset.
- **[P1] Motion is press-squash only.** Missing ESS today-card, approvals spring, payday underline. KpiNumber uses rAF + React state (05 §2.4). Suggested: /impeccable animate.
- **[P1] ESS 2-click fails.** Regularise 3-4 clicks; Apply leave is a header link; no Requests; Travel/Policies in primary rail. Suggested: /impeccable distill + layout.
- **[P1] Role landings ignore 08 §3.** Payroll lands on HR ops; CEO logo goes to /; manager gold is not the inbox; no senior subtree toggle. Suggested: /impeccable shape.

## Persona Red Flags

**Rachna (basic ESS):** Filing-cabinet rail. Greeting pretty, chrome says "you are a record." Payslip chip often empty. No announcements.

**Alex (impatient manager):** Inbox not gold on home. No swipe-away. OT 48h is a sibling nav item. Team hover is a native tooltip.

**Jordan (first-timer shop floor):** E-code login is good. Then English density, hamburger to a long rail, no bottom-sheet daily actions.

## Minor Observations

- Login split charcoal/cream is the closest Crextio moment; copy is generic B2B.
- Muted ink #6f6b62 on canvas #ecebe6 is 4.4:1 (need 4.5).
- Approvals "Technical payload" on the hero is ops internals.
- PendingModule "For the build team" ships to employees.
- 05 §3 vs 05 §7 spec conflict: code followed sidebar-capable; 12 photographs pill nav.

## Questions to Consider

- If you blur the content, is the chrome Crextio or greytHR with nicer variables?
- Why did sidebar-capable beat the photographed header?
- Why does Settings get the same ceremonial serif as Hello Rachna?
