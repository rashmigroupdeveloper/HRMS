# 05 — UI/UX Specification (Warm Editorial design language)

The HRMS must be visually indistinguishable from the existing ATS — same tokens, same primitives, same motion. The authority for the design language is the ATS repo: `frontend/src/index.css` (tokens, verbatim below) and `DESIGN_RESEARCH.md` (evidence-based rules). This spec applies them to HRMS screens.

## 0. Provenance — where this design language comes from

The ATS's "Warm Editorial" system is inspired by **Crextio**, an HR-platform design concept by **Nixtio** (designer Bogdan Nikitin) — verified: [Nixtio's official Crextio case study](https://nixtio.com/cases/crextio), [Dribbble shot](https://dribbble.com/shots/25121521-HR-Management-Dashboard-Design), [studio profile](https://dribbble.com/Nixtio). (The ATS's own DESIGN_RESEARCH.md §6 flagged the attribution unconfirmed at the time; it is now confirmed.)

What the Crextio/Nixtio language contributes, and how the ATS adapted it:
- **Warm cream canvas + selective charcoal hero cards + one gold accent** — the signature. Nixtio treats **color as a functional component** (warm parchment/charcoal palettes to reduce blue-light fatigue and ground the UI), not branding decoration (per the ATS `Ui analysis.md` study of Nixtio: e.g. #120E0C charcoal / #E7E3D6 parchment reference values).
- **Large radii (24px), soft warm-tinted shadows, minimal borders**; pastel status pills; big light-weight display greetings ("Hello Valentina" → our ESS "Hello Rachna").
- **Motion as usability**: kinetic feedback confirming status, never decoration — matching Emil Kowalski's restraint principle adopted in DESIGN_RESEARCH §2.
- The ATS did **not** copy Crextio's hexes; it derived its own token set (§1 below) in the same spirit — those ATS tokens, not Crextio's, are the law for the HRMS.
- **Mood & atmosphere reference:** see **12-VISUAL-REFERENCE-CREXTIO.md** — the Nixtio design philosophy ("light and shadow, spatial hierarchy, softness in transitions, visual warmth and clarity"), the realized ATS recipe (incl. the charcoal grain texture on hero cards), 2026 trend validation (warm neutrals as the premium direction; Pantone "Cloud Dancer"), and a curated mood board. That doc is the *why/feel*; this doc is the *rules/tokens*.

### 0.1 Design-language firewall (READ THIS — protects the vision from the research)

The reconnaissance and code discovery in docs 09–11 exposed two *other* systems with *other* looks. They contributed **data, behavior, and backend patterns only — never visual language.** Non-negotiable rules:

1. **greytHR is a FUNCTIONAL reference and a VISUAL ANTI-reference.** Where docs 09/10 say "parity" with greytHR, that means *feature/menu/field coverage* — the same capabilities — **never** its appearance. greytHR's plain blue utilitarian UI is the "cheap enterprise tool" look this project exists to beat. Never copy a greytHR screen's styling.
2. **Yatra Avedan's frontend is Material UI (MUI). When it is absorbed (M13/Phase 3.5), its UI is REBUILT in Warm Editorial — MUI is dropped entirely.** Port its *backend* (TypeScript modules, services, models, approval/settlement logic) and its *data*; throw away its MUI components and rebuild every T&E screen from `packages/ui` (Card/DarkCard/DataTable/Drawer/etc.) on the ATS tokens. A ported MUI screen inside this platform is a defect, not a shortcut.
3. **No second component library, ever.** Tailwind + `packages/ui` (Warm Editorial) is the only UI system. No MUI, no Material, no Bootstrap, no Ant — not "just for the T&E module," not "to reuse Yatra Avedan faster." One design language across every screen, or the whole premium feel collapses.
4. **The AI-slop / anti-reference discipline (§7b) and the signature moments (§6) still govern T&E and every absorbed surface** — travel, claims, and settlement screens get the same craft bar as payroll and attendance.

If any future work reintroduces MUI, a blue enterprise palette, or a greytHR-style layout "to save time," it has corrupted the vision — reject it.

## 1. Design tokens (copy from ATS — single source of truth)

Tokens live in `packages/tokens` and are the *exact* values shipping in the ATS today (`index.css`, "Warm Editorial system, Crextio-inspired"):

```css
:root {  /* Light */
  --canvas:#ecebe6;  --surface:#fbf9f3;  --surface-2:#f1eee5;
  --ink:#1c1c1e;     --ink-muted:#6f6b62; --ink-faint:#a8a399;
  --line:#e7e2d6;    --line-strong:#dcd5c4;
  --accent:#f4cb45;  --accent-ink:#1c1c1e; --accent-soft:#fbeec0;
  --hero:#1c1c1e;    --hero-ink:#fbf9f3;   --hero-muted:#9b978d;
  --positive:#2f9e6f; --negative:#d4574e;  --warning:#c98b3a; --info:#5b7fa8;
}
.dark {
  --canvas:#141416;  --surface:#1f1f22;  --surface-2:#27272b;
  --ink:#f4f1e9;     --ink-muted:#a8a29a; --ink-faint:#6d6a64;
  --line:#34343a;    --line-strong:#3f3f46;
  --accent:#f4cb45;  --accent-ink:#1c1c1e; --accent-soft:#3a3318;
  --hero:#0f0f11;    --hero-ink:#f4f1e9;   --hero-muted:#8a867d;
  --positive:#43c98c; --negative:#e87a72;  --warning:#e0a960; --info:(ATS value);
}
/* Radii: --radius-card:24px; --radius-tile:18px; --radius-row:14px
   Font: Manrope (400/500/600/700) via <link>, ui-sans-serif fallback */
```

Non-negotiable rules (from DESIGN_RESEARCH, all verified claims):
1. **No borders where shadow/contrast/spacing works.** Cards separate from the cream canvas by surface color + soft shadow + 24px radius, not 1px grey lines.
2. **One gold accent per view** — the single most important metric or CTA. Never five yellow things.
3. **At most one charcoal "hero" card per screen** (the dark feature card).
4. **Warm greys only** (`--ink-muted #6f6b62`), never blue-greys; near-black `#1c1c1e`, never `#000`.
5. **Tabular numerals** (`font-variant-numeric: tabular-nums`) on every number that aligns or animates (payroll amounts, KPIs, muster grids).
6. **Pastel status pills** with icon/label — color is never the only signal (accessibility).
7. Dark mode is first-class: semantic variables flip in `.dark`; never hardcode a hex in a component.

## 2. Motion doctrine (Emil Kowalski's design-engineering framework — the authority for all motion)

Source: the `emil-design-eng` skill (Emil Kowalski, Linear; animations.dev, builder of Sonner/Vaul — both already ATS dependencies). This supersedes the earlier generic tokens.

### 2.1 The frequency test comes before any animation code

| How often does the user see it? | Decision |
|---|---|
| 100+ times/day (⌘K palette, keyboard approve `a`/`r`, grid row navigation) | **No animation. Ever.** Keyboard-initiated actions never animate — animation makes them feel slow and disconnected. |
| Tens of times/day (hovers, drawer opens for HR ops, inbox cards) | Minimal — 100–200ms, or none |
| Occasional (modals, toasts, month-lock, route changes) | Standard animation |
| Rare / first-time (payday moment, finalize ceremony, onboarding, "all caught up") | Can add delight — this is where the §6 signature moments live, and *only* here |

Every animation must name its purpose: feedback, state indication, spatial continuity, or preventing a jarring change. "Looks cool" + seen often = cut it.

### 2.2 Tokens (upgraded — stock CSS easings are too weak)

```css
:root {
  /* Durations */
  --motion-press:   140ms;  /* button/row press feedback (100–160 band) */
  --motion-micro:   150ms;  /* hover, toggle, tooltip (125–200) */
  --motion-short:   200ms;  /* dropdowns, selects (150–250) */
  --motion-medium:  300ms;  /* drawers, modals — UI ceiling; never exceed for UI */
  --motion-counter: 800ms;  /* KPI count-up (rare surfaces only) */

  /* Easing — custom curves, not built-ins */
  --ease-out-strong:   cubic-bezier(0.23, 1, 0.32, 1);    /* enter/exit — the workhorse */
  --ease-inout-strong: cubic-bezier(0.77, 0, 0.175, 1);   /* on-screen movement */
  --ease-drawer:       cubic-bezier(0.32, 0.72, 0, 1);    /* right-drawer slide (iOS-like) */
  --ease-std:          ease;                               /* hover/color only */
}
```

**Never `ease-in` on UI** (delays the initial movement the user is watching for — feels sluggish). **Never `transition: all`** — name the exact properties. Exits run faster than enters (~65%).

### 2.3 Component motion rules (mandatory, code-review enforced)

- **Every pressable element:** `transform: scale(0.97)` on `:active`, `--motion-press` with `--ease-out-strong`. The UI must feel like it's listening.
- **Never animate from `scale(0)`** — nothing real appears from nothing. Enter from `scale(0.95)` + `opacity: 0` (use `@starting-style`, fallback `data-mounted`).
- **Popovers/dropdowns scale from their trigger** (`transform-origin` from the anchor), never from center. **Modals are the exception** — they stay centered.
- **Tooltips:** delay the first (prevent accidental fire), then **instant with no animation** for adjacent ones while one is open — makes the whole muster/toolbar feel faster.
- **CSS transitions over keyframes** for anything rapidly re-triggered (toasts, row selection, OT batch approve) — transitions retarget smoothly mid-flight; keyframes restart from zero.
- **Springs** (Motion, Apple-style `{type:"spring", duration:0.5, bounce:0.2}`) only for interruptible gestures and the approvals card-swipe; bounce ≤ 0.2; never on form fields or destructive actions.
- **Crossfade seams** (payslip month switch, tab content swaps): if it feels off, add `filter: blur(2px)` during the transition to bridge the two states; keep blur tiny.
- **Stagger** list entrances 30–80ms/item, capped ~300ms total, never blocking interaction; legitimate within one list, not as a uniform reflex on every section.
- **Hover effects gated** behind `@media (hover: hover) and (pointer: fine)` — tablets at the plant will tap.
- **Reduced motion = gentler, not zero:** keep opacity/color transitions that aid comprehension; remove positional movement. KPI counters snap to final value.

### 2.4 Motion performance (from Vercel-dashboard production lessons)

- Animate `transform`/`opacity` only. Framer Motion's `x`/`y`/`scale` shorthands are **not hardware-accelerated** (main-thread rAF) — for anything animating while data loads (route transitions, dashboard first paint), use the full `transform` string or plain CSS animations, which run off the main thread.
- Never update an inherited CSS variable per-frame on a container (recalcs every child — the virtualized muster grid would die); set `transform` directly on the moving element.
- Banned: `window.addEventListener('scroll')` handlers, `window.scrollY` in React state, rAF loops touching React state. Use IntersectionObserver / motion values.
- Debug ritual: test animations at 5× slow motion and frame-by-frame before shipping; re-review with fresh eyes next day.

### 2.5 Cohesion (the Sonner principle)

Match motion to the product's personality: this is a professional daily tool on a warm editorial surface — **crisp and fast, slightly elegant**: `ease` on hovers, strong ease-out on movement, no bounce anywhere except the approvals card dismissal. KPI numbers animate **once on load and on real change**, never on polls. Container-transform for row → drawer, shared-axis for tabs, fade-through for content swaps.

## 3. Application shell

Same skeleton as the ATS: masthead + pill navigation with dark active segment, cream canvas, content in a card grid.

```
┌ Masthead: logo · pill-nav (Dashboard | People | Attendance | Leave | Payroll | Lifecycle | Assets | Helpdesk | Reports) 
│           · global search (⌘K) · notification bell · approvals badge · avatar/theme toggle
├ Canvas (cream): page content, max-w constrained, 24/32px section gaps
└ Drawers slide from right for detail views; modals only for confirmations
```

- Navigation shows only modules the role can access — the exact per-role shell (employee, manager, senior manager/manager-of-managers, hr_ops, hr_head, payroll, plant head, ceo_cell, it_admin, super_admin) is specified in **08-ROLES-AND-PERMISSIONS §3** and is the implementation reference.
- **Approvals inbox** is one click from anywhere (badge count in masthead) — the #1 daily-loop action for managers; each decision ≤ 2 clicks (approve inline from the list).
- Global search (⌘K): employees by name/ecode, assets, tickets, pages.
- Persist per user: filters, sort, column selections, last-viewed tabs (adoption rule §4.2 — "recruiters hate re-applying filters", same for HR).

## 4. Page specs (by module)

Layout conventions reused everywhere: KPI tile row on top (animated numbers, tabular-nums) → filter bar (7–10 options in accordion "More filters"; async, debounced 200–300ms, results-region-only loading — never freeze the UI) → DataTable (sticky header, right-aligned numbers, row hover = `--accent-soft` wash, row click = right drawer) → Excel export button running the same query as the view (RPT-06).

### 4.1 HR Dashboard (landing for HR roles)
- KPI row: Headcount (by category chips), Joiners MTD, Exits MTD, Absent today, Pending approvals, Unacknowledged policies.
- **Hero (dark) card:** "Attendance today" — present/absent/UAB/on-leave donut + device-health warning strip if any Kent door is silent (ATT-02 visibility).
- Cards: This week's joiners/exits list · Absence cases by stage (watch/show-cause) · OT pending approval aging · Probation due next 30 days · Policy acknowledgment % · Helpdesk SLA tile.
- Gold accent: single most attention-worthy figure of the day (e.g., UAB count).

### 4.2 Employee directory & profile (M1)
- Directory: table (photo, ecode, name, designation, dept, RM, cost center, category pill, status pill); filters: entity, plant, dept, category, status, RM; export = master report incl. functional RM (PI-PAY-8).
- Profile page: identity header card (photo, ecode, pills, quick actions) + tab set: Overview · Job & Reporting (with effective-dated history timeline) · Compensation (permission-gated, masked otherwise) · Statutory & Bank · Documents & Letters · Attendance (mini-muster) · Leave balances (per-type tiles + ledger) · Assets · Requests. Progressive disclosure: 4–5 fields per row on the surface, drawers for depth.
- Onboarding sub-flow: convert-candidate wizard (prefilled from LOI payload, e-code preview, salary auto-built from CTC + probation %), task checklist board per new joiner (LC-02 status at a glance).

### 4.3 Attendance (M2)
- **My attendance (ESS):** month calendar with status glyph+color per day; day tap → swipe timeline (first-in/last-out, doors); buttons: Regularize (past), Apply OD (past/future — KQ), view OT.
- **Team view (manager):** month grid (rows = team, columns = days, status glyphs) — this is the on-screen muster; week-off/roster editor with bulk fill (ATT-04); pending AR/OD/OT strip on top.
- **HR ops:** muster summary (RPT-01 columns incl. RM/EmpID/cost-center), unmatched-swipe exception queue, device health board (last-seen per door, gap alerts), month-lock checklist screen (ATT-15 preconditions, red/green, then Lock button).
- OT approvals: list grouped by day with detected vs claimed minutes, batch approve, deadline countdown pill (48h rule visible, not hidden).

### 4.4 Leave (M3)
- ESS: balance tiles per type (accrued/used/available, comp-off with expiry warnings), apply form (live balance math, sandwich preview: "27–29 Jun = 2 days (Sunday excluded)"), applications timeline (WF-04 pattern).
- HR: leave register, accrual-exception tile (LV-02), encashment processing, year-end carry-forward preview.

### 4.5 Payroll (M4) — the most careful UI in the product
- **Run console:** stepper reflecting run state (Draft → Inputs locked → Computed → Review → Approved → Finalized), each step showing its gate (attendance locked?, inputs count, negative-net flags). One run per screen; no ambient editing.
- **Review grid:** employees × (payable days, LOP, gross, deductions, net, Δ vs last month) — Δ sorted, threshold-highlighted; row → drawer with the full payslip preview and per-line `calc_note` ("BASIC 40,000 × 28.5/30") — explainable numbers build the trust that makes HR adopt the tool (DESIGN_RESEARCH §4.2 black-box rule).
- Finalize = typed-confirmation modal ("FINALIZE JUNE 2026") — the one place a heavy confirmation is right.
- Outputs card: payslips ZIP, bank file, JV, PF ECR, ESIC, PT, TDS register — each with generated-at stamp and download.
- ESS payslip view: fixed template (PAY-06), month picker, YTD tax card with regime + declaration link.
- Parallel-run screen (transition only): Protiviti register upload → per-component Δ table → sign-off action (§04 6.8).

### 4.5b Claims (M12)
- ESS: entitlement tiles per claim type (used/available with period), claim form (amount + bill uploads + live balance check), claim history timeline.
- Manager/HR: verify queue with bill previews inline (drawer), partial-approval amount field, rejection-reason required.
- Payroll: pay-batch screen — approved claims grouped, include-in-run vs off-cycle-batch toggle, batch bank-file download.

### 4.6 Lifecycle (M5)
- Probation board: due-date sorted cards → review drawer (recommendation, extend/confirm) with chain status.
- Separations: pipeline view (Pending → Approved → Clearances → F&F → Closed); each case a timeline showing every approver + `notified_at` (the anti-PP-14 receipt trail); clearance checklist per department with asset list embedded.
- Boarding/exit report page: yesterday's email rendered live + history archive.

### 4.7 Reports (M7)
- Catalog of saved reports (06-REPORTS) as cards; each opens filter form → on-screen table → Export. Excel styling via ExcelJS mirrors on-screen columns exactly — what you see is what finance gets.

### 4.8 CEO Dashboard (RPT-03)
- Route `/executive`, read-only role, **large-monitor first** (test at 1920×1080 and 2560×1440 — the Workday lesson).
- Top band: manpower demographics table exactly as the pptx: rows (Count, Avg age, Tenure, Leadership %, Contract dependency ratio, Avg CTC) × columns (Total, White Collar, Trainee, Blue Collar, Contract*, Consultants) — animated numbers, tabular-nums. (*Contract column reads "Phase 4" until that module exists — never fake data.)
- Middle: productivity & cost cards (Labour productivity, Output/man-hour, Cost/man-hour, Cost/unit, OT hours + cost) — gold/charcoal two-series charts only (locked chart palette).
- Bottom: Attendance & engagement — absenteeism trend line, attrition rate, leavers, **new-hire attrition 3/6/12 months** (slide 2), burnout index (defined in 06-REPORTS §3).
- Auto-refresh on interval without re-animating counters unless values changed.

### 4.9 ESS home (every employee's landing)
- Greeting header (light-weight display type, "Hello Rachna" — the Crextio signature), today's shift + swipe status, leave balance tiles, payslip quick-link, pending requests, announcements feed, policy-acknowledgment prompts (blocking banner until acknowledged, per CORE-13).
- Mobile: this page and Apply Leave/AR/OD/check-in are the PWA surface (geo check-in button for `attendance_mode='mobile'` staff).

## 5. Component inventory (packages/ui — port from ATS, don't rebuild)

`Card` · `DarkCard` (hero) · `Pill` / `StatusBadge` (pastel + icon) · `KpiNumber` (animated, tabular) · `DataTable` (sticky header, virtualized ≥ 200 rows via @tanstack/react-virtual — already an ATS dep, right-aligned numerics, column chooser, persisted state) · `FilterPanel` (accordion, async) · `Drawer` (right, container-transform) · `Timeline` (workflow steps with timestamps — exists in ATS offer tracker) · `EmptyState` (explains why + one CTA) · `ConfirmModal` (typed confirmation variant) · `MonthCalendar` (attendance) · `RosterGrid` · `ApprovalInbox` · `Toast` (sonner) · `FormField` primitives (react-select, react-datepicker already themed in ATS).

**Crextio-signature components confirmed by direct observation (12-VISUAL-REFERENCE §7) — build these into `packages/ui`:**
- `KpiPillRow` — the **4-state metric pill row**: black-filled / gold-filled / diagonal-hatched (in-progress) / outline-ring. The signature dashboard header.
- `HatchFill` — reusable **diagonal-hatch texture** for in-progress / remaining / inactive / weekend states (low-contrast, warm). Used across pills, progress remainders, calendar weekend cells.
- `SegmentedProgress` — **tri-segment bar** (gold filled → charcoal → hatched remainder) with numeric labels above (Salary/allocation views).
- `IconButton` — **white circle + soft shadow** icon button (↗ open, chat, call, +, filter, ⋯) used pervasively.
- `DotMatrix` — compact **dot-grid heatmap** (gold = present / grey = absent) for the attendance mini-viz.
- Canvas: apply the **warm bottom-right gradient** (light warm-grey → pale-gold `~#F7E9B0` corner) as the app background, not a flat cream fill.
- Row states: **hover = `--accent-soft` wash; selected = SOLID gold fill** (refines §3.3 — Crextio uses a bold full-yellow selected row, not a subtle wash).
- Profile headers may use **full-bleed photo + frosted-glass info cards** (the one sanctioned glass use — profile headers only; not decorative elsewhere).
- Chart tooltips = **small charcoal pills**; line charts = gold solid + grey dashed two-series; donuts = gold + charcoal with big centered number.

## 6. Signature experience playbook — "Crextio and beyond"

Being *pleasing* and being *un-leavable* are different achievements. Pleasing comes from the token system (§1–2). Un-leavable comes from **signature moments** — one deliberately crafted peak per surface — plus removing every micro-frustration of the old tools. Design budget rule: each page gets exactly one signature moment; everything else stays calm (the accent discipline, applied to delight).

| Surface | Signature moment (build it deliberately) |
|---|---|
| ESS home | The greeting: light-weight display type "Hello Rachna", live shift chip beneath, and the day's single most relevant card auto-surfaced (payday week → payslip card slides to front; pending ack → policy card). The page *knows what today is*. |
| Payslip (payday) | **The payday moment**: net-pay figure count-up (800ms, once), gold underline sweep, one-tap PDF. This is the highest-emotion touchpoint in any HRMS — most vendors render a grey table. Ours feels like getting paid. |
| Approvals inbox | The clear-out: approve slides the card away with a spring, next card rises; on emptying the queue, a quiet "All caught up" state with a warm illustration. Managers should *want* inbox-zero. |
| Muster (HR ops) | Instant recompute: change a filter, 2,500-row grid updates under 300ms (virtualized, precomputed) with a subtle column shimmer on the region only. Speed *is* the delight here — nothing else animates. |
| Payroll finalize | The ceremony: stepper completes, a full-width charcoal band confirms "June 2026 finalized — 2,412 payslips issued" with the run hash and timestamp. Gravity, not confetti. |
| CEO dashboard | The opening: KPI counters roll in once with 40ms stagger on first paint of the day, then never re-animate. Feels alive, never busy. |
| Team month-grid | Hover a day-cell → 150ms tooltip with first-in/last-out and door name. The manager's "wait, he *was* there" question answered without a click. |

**Micro-frustration kill-list** (each one is a reason people hated greytHR/Workday — all are hard requirements):
1. Nothing the user does twice a day is ever > 2 clicks (approve, regularize, muster, payslip).
2. No filter, sort, column choice, or scroll position is ever lost — per-user persisted, restored on back-navigation (`state-preservation`).
3. No spinner longer than 300ms without a skeleton; no skeleton that doesn't match the final layout (`progressive-loading`).
4. No form loses typed text — drafts autosave; dirty modals confirm before dismissing (`form-autosave`, `sheet-dismiss-confirm`).
5. No error without a recovery path ("retry", "edit", or who to contact) (`error-recovery`, `error-clarity`).
6. No destructive action without undo where reversible, typed-confirm where not (`undo-support`).
7. Every long list virtualized at ≥ 50 rows (`virtualize-lists` — @tanstack/react-virtual, already an ATS dep).
8. Keyboard-first for power users: ⌘K everywhere, `a`/`r` approve/reject in inbox, arrow-key row navigation in grids, visible focus rings, tab order = visual order — HR ops lives in this tool 8h/day.
9. Every date input uses the right widget and the right keyboard on mobile (`input-type-keyboard`); every number column tabular and right-aligned (`number-tabular`).
10. Notifications never steal focus (`toast-accessibility`, aria-live polite); badge counts clear when visited (`tab-badge`).

## 7. Hard quality bar (adopted from the UI/UX guideline database — enforced in code review)

**Accessibility (CRITICAL — non-negotiable):**
- Text contrast ≥ 4.5:1 (3:1 for large text) in **both** themes, tested separately — warm cream backgrounds make this easy to fail with `--ink-faint`; faint text is decorative-only, never load-bearing (`color-accessible-pairs`, `color-dark-mode`).
- Color never the only signal: status pills always icon + label (`color-not-only`).
- All icon-only buttons carry `aria-label`; SVG icons only (Lucide) — never emoji as UI (`no-emoji-icons`).
- Forms: visible labels (never placeholder-only), inline validation on blur not keystroke, error below the field naming cause + fix, focus jumps to first invalid field on submit, `role="alert"` for errors (`input-labels`, `inline-validation`, `error-placement`, `focus-management`, `aria-live-errors`).
- Full keyboard support incl. charts (tooltips keyboard-reachable); skip-link to main content; heading hierarchy sequential; `prefers-reduced-motion` respected everywhere.

**Interaction & performance:**
- Press feedback within 100ms; async buttons disable + show progress (`loading-buttons`, `tap-feedback-speed`).
- Micro-interactions 150–300ms, exits ~65% of enter duration, transform/opacity only — never animate width/height/top/left (`exit-faster-than-enter`, `transform-performance`, `layout-shift-avoid`).
- Reserve space for async content — CLS < 0.1; skeletons for content-shaped regions (`content-jumping`).
- Debounce search/filter 200–300ms; input latency < 100ms; route-level code splitting so Payroll's heavy grids never slow ESS (`debounce-throttle`, `bundle-splitting`).
- Touch targets ≥ 44×44px with ≥ 8px gaps on all ESS/mobile surfaces (`touch-target-size`).

**Charts (CEO/HR dashboards):**
- Two-series palette locked (gold = subject, charcoal/grey = comparison); gridlines low-contrast; trend over decoration — no gradients/shadows on data (`gridline-subtle`, `trend-emphasis`).
- Legends always visible; tooltips show exact values; direct labels for small datasets (`legend-visible`, `direct-labeling`).
- Every chart has a table/export alternative (they do — the report catalog) and an explicit empty and error state with retry — never a blank axis frame (`data-table`, `empty-data-state`, `error-state-chart`).
- Pie/donut never > 5 categories; aggregate 1000+ point series with drill-down (`no-pie-overuse`, `large-dataset`).
- Locale formatting: INR lakh/crore grouping on every axis and label (`number-formatting`).

**Navigation:**
- Active nav state always visible; nav placement identical on every page; deep links for every screen (approval emails link straight to the request); back always restores state (`nav-state-active`, `deep-linking`, `back-behavior`).
- Modals never used for primary flows — drawers and pages are the navigation; modals only confirm (`modal-vs-navigation`).
- ≥ 1024px = sidebar-capable shell, mobile = bottom-sheet patterns for ESS actions (`adaptive-navigation`).

**Skill-recommendation note:** the ui-ux-pro-max design-system generator proposed a blue/Fira "data-dense dashboard" system for this product class. **Rejected deliberately** — the design language is locked to the ATS Warm Editorial tokens (D4); we adopt the database's *behavioral* guidelines (above) and its anti-pattern list ("ornate design", "no filtering") which our system already satisfies. Any future AI regenerating a design system for this project must not override §1 tokens.

## 7b. Product register & anti-slop bans (from the `impeccable` and `taste` skills)

**The product slop test** (impeccable, product register): the bar is not "would someone say AI made this" — familiarity is a feature in product UI. The bar is **earned familiarity**: would a user fluent in Linear/Stripe/Notion sit down and trust every component, or pause at subtly-off ones? Product UI's failure mode is *strangeness without purpose*. The tool should disappear into the task.

**Register rules adopted:**
- **One type family** (Manrope) across headings, labels, buttons, data — product UI needs no display/body pairing. **Fixed rem scale** (no fluid `clamp()` headings in-app), tight ratio 1.125–1.2 between steps.
- **Every interactive component ships all seven states**: default, hover, focus, active, disabled, loading, error. Half-stated components don't merge.
- **Consistent component vocabulary**: if the Save button looks different on two screens, one of them is wrong. Same form controls, same icon family (Lucide only), same drawer behavior everywhere.
- **Second neutral layer** for rails/toolbars (`--surface-2` / `--line-strong`) distinct from content surfaces — already in the token set; use it, don't invent panel colors.
- **No orchestrated page-load choreography** — the product loads into a task. (CEO dashboard's once-a-day counter roll is the §6-budgeted exception.)
- **Modal as last resort** — exhaust inline and drawer alternatives first; modals only confirm (§8 already; now a register rule too).
- **Density is permitted** where users need it (muster, review grid); consistency over surprise; delight saved for §6 moments, never spread across pages.

**Absolute bans (match-and-refuse — rewrite the element if about to produce one):**
- Side-stripe accents (`border-left` > 1px colored) on cards/alerts/list items → use full soft borders, background tints, or leading icons.
- Gradient text (`background-clip: text`), glassmorphism-as-default, decorative blur.
- The hero-metric template (big number + small label + gradient accent) — KPI tiles follow §5 `KpiNumber` spec, charcoal/gold discipline, not SaaS-cliché stat cards.
- Identical card grids (same icon+heading+text card × N) — vary composition by content.
- Eyebrow kickers (tiny uppercase tracked labels) above every section/card title; display fonts in labels; custom scrollbars; reinvented standard controls.
- Placeholder-as-label (label above input, always); button text that wraps at desktop; two CTAs with the same intent on one screen (one label per intent, everywhere); white-on-white/unreadable buttons (contrast-check every CTA in both themes).
- Full-saturation accents on inactive states; cream-on-cream card fields with typography only where a tint/illustration is warranted (empty states).

## 8. UX guardrails (verified rules, enforced in review)

- Daily-loop actions ≤ 2 clicks: approve request, regularize a day, download muster, open employee, run payslip search.
- Filters never freeze; empty states explain and offer "clear filters"; zero-result ≠ blank table.
- Long forms (onboarding, F&F) are disclosed steps, not one scroll of 60 fields (Workday lesson).
- Undo where reversible; typed confirmation only for payroll finalize, month lock, exit conversion.
- Every AI-free number is explainable: payslip lines carry calc notes; KPI tiles link to their underlying list.
- Never lose typed data: forms autosave drafts (leave/resignation/AR text preserved on navigation).
- Loading: skeletons for content-shaped regions (tables, cards); spinners for short unpredictable waits — matched to the wait, not dogma.
