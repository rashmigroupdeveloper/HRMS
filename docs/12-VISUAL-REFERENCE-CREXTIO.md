# 12 — Visual Reference: Crextio / Nixtio & the Warm Editorial Lane

**Purpose:** capture the *feel* the sponsor is after — deeper than hex codes — as a mood/reference companion to 05-UIUX. **This does NOT change the token law** (05-UIUX §0.1 firewall stands): the ATS tokens remain authoritative. This doc explains the *why* and *atmosphere* behind them, adds current (2026) validation, and gives a curated mood board so future UI work stays on-feel.

**Research date:** 6 Jul 2026 (expanded from 14 → **20** sponsor-provided screens). Note: Dribbble/Nixtio image assets are bot-walled to scripts; the concrete visual values below come from (a) the ATS's own realized tokens + `DESIGN_RESEARCH.md` + `Ui analysis.md`, (b) verified 2026 design-trend sources, and (c) direct observation of the 20 Crextio reference images. The single best reference for "what the user wants" is **the ATS itself** — it already realizes this aesthetic; this doc closes the remaining gaps.

---

## 1. Crextio / Nixtio — the design philosophy (the atmosphere to hit)

Crextio is an HR platform design by **Nixtio** (Bogdan Nikitin). From Nixtio's own words and case study:
- Scope: "Research & UX, Platform Design, Mobile App, Brand Visual Identity, Motion Design," 12 weeks. Goal: **"unify the visual language and interaction patterns while maintaining clarity and trust across a complex product ecosystem."** ([Nixtio case](https://nixtio.com/cases/crextio))
- Nixtio rejects a fixed "signature style"; their craft is: **"thoughtful use of light and shadow, intuitive spatial hierarchy, and a softness in transitions that makes digital interfaces feel more human."** They design for the **atmosphere** of a product and bring **"visual warmth and clarity"** even to UX-heavy work.
- From the ATS `Ui analysis.md`: Nixtio treats **color as a functional component** (not decoration) — grounding, human-centric, reduces blue-light fatigue. Reference values cited there: `#120E0C` charcoal, `#E7E3D6` parchment, `#DE998F` terracotta.

**The one-sentence feel:** *a warm, calm, editorial workspace — cream paper, one charcoal anchor, one gold highlight, soft light-and-shadow depth, and motion that feels human — that makes a data-dense HR tool feel premium and trustworthy instead of cold and corporate.*

## 2. The realized aesthetic (the ATS — ground truth, already what you want)

The ATS didn't copy Crextio's hexes; it derived the same *feeling* in its own palette. This is the reference to build against:

- **Canvas:** warm cream `#ecebe6` app / `#fbf9f3` surface — not cold white. (The 2026 move; see §4.)
- **Anchor:** charcoal `#1c1c1e` — used for the *one* dark "hero" card per screen. The ATS renders it with a real **charcoal photographic texture** (`public/charcoal 1.jpg`, `textures/charcoal-*.webp`) — grain adds depth without extra color. Keep this treatment for HRMS hero cards.
- **Accent:** soft gold `#f4cb45` + wash `#fbeec0` — the single "important" signal per view.
- **Ink ramp:** near-black `#1c1c1e` → warm muted `#6f6b62` → faint `#a8a399` (warm greys, never blue-greys).
- **Radii:** 24px cards / 18px tiles / 14px rows — large & soft is the signature.
- **Shadows:** soft, low-contrast, warm-tinted (not harsh).
- **Type:** Manrope (UI + data), big **light-weight display** headings ("Hello Valentina", "People", "Salary"), tabular numerals. **Editorial exception:** the desktop dashboard welcome ("Welcome in, Nixtio") uses a **serif display** for the greeting only — warm, magazine-like; everything else stays geometric sans.
- **Signatures:** pill navigation with a dark active segment; donut/ring charts in gold + charcoal two-series; pastel status pills.

## 3. Concrete recipe — how the feel is produced (for anyone building a new screen)

| Ingredient | Do this | Why (the Nixtio principle) |
|---|---|---|
| Depth | Soft warm shadow + 24px radius + cream separation — **no borders** | "light and shadow," premium without heaviness |
| Warmth | Cream/parchment surfaces + grain texture on dark cards | "visual warmth," reduces fatigue, human |
| Focus | Exactly one gold accent + one charcoal hero per view | spatial hierarchy; the accent means "important" |
| Calm | Generous spacing, few lines, progressive disclosure | clarity in a complex product; trust |
| Life | Human motion (Emil doctrine §05-2): count-ups, spring dismissals, container-transform | "softness in transitions that feels human" |
| Craft | Tabular numerals, balanced headings, pastel+icon status | the invisible details that read as premium |

## 4. 2026 validation — the direction is current, not a guess

Verified against current design-trend sources — the Warm Editorial lane is precisely the 2026 premium direction:
- **Warm neutrals are the 2026 reaction against cold corporate white** (`#F5F0EB`, `#E8E0D5` range) — "human, approachable, editorial"; Notion-adjacent products use warm off-whites to reduce eye strain and signal a "thoughtful" brand. **Pantone 2026 Color of the Year = "Cloud Dancer"** (warm off-white) — the shift away from cold white. ([updivision](https://updivision.com/blog/post/ui-color-trends-to-watch-in-2026), [Muzli](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/))
- **Charcoal + two warm gold accents = premium/luxury/fintech** signal — complexity delivered with elegance.
- **Bento-grid modular card layouts** dominate (cited ~67% of top SaaS) — scannable, flexible; exactly the ATS card grid.
- **Texture (grain/paper/linen) + gentle tonal steps** (cream → beige sand → taupe) add depth "without adding new colors" — validates the ATS's charcoal grain and the warm-grey ramp.
- Soft shadows + rounded corners + clean type = "cultivate trust," "elevated, intentionally crafted."

Takeaway: building the HRMS in the ATS's Warm Editorial system is not just brand consistency — it's on the leading edge of 2026 premium product design.

## 5. Curated mood board (similar references, same lane)

For future inspiration that stays *on-feel* (study the atmosphere, never copy pixels — firewall §0.1):
- **Nixtio / Bogdan Nikitin** — Crextio HR, plus his Finance / Business-Management / Analytics dashboards ([dribbble.com/Nixtio](https://dribbble.com/Nixtio), [behance.net/artnikitin](https://www.behance.net/artnikitin)) — the primary reference.
- **Warm-neutral productivity tools** — Notion's warm off-white surfaces; "thoughtful/calm" editorial SaaS.
- **Bento-grid dashboards** — [Muzli 50 best 2026](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/), [SaaSFrame bento guide](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide).
- **Palette anchors** to sample from (reference only): warm cream `#F5F0EB`/`#E8E0D5`, parchment `#E7E3D6`, charcoal `#120E0C`/`#1c1c1e`, terracotta `#DE998F` (a possible *secondary* warm accent for illustrations/empty-states — NOT a second UI accent; gold stays the only action accent).
- **Anti-references (do NOT emulate):** greytHR (cold blue utilitarian), generic Material/AdminLTE admin themes, cold-corporate navy SaaS. These are what the project beats.

## 6. Screen inventory — 20 sponsor reference images (6 Jul 2026)

Study the *patterns*, never copy pixels (firewall §0.1). Grouped by surface:

| # | Surface | Screen | Key patterns to extract |
|---|---|---|---|
| 1 | Desktop | **Dashboard** | Serif welcome, 4-state KPI pills, icon KPI cluster (Employees/Hirings/Projects), profile hero card, accordion sidebar, weekly bar chart, circular time tracker, week calendar, onboarding segmented bar + dark task card |
| 2 | Desktop | **People** | Table + dotted row separators, multi-select, solid-gold selected row, filter bar, Directory/Org Chat/Insights pills |
| 3 | Desktop | **Devices** | Device category cards, world map with location pins + tooltip, security gauge, Session History dark card |
| 4 | Desktop | **Pricing** | Annual/Monthly toggle, 3-tier cards, featured dark center card + yellow border, Save-% diagonal badge, feature check/X lists |
| 5 | Mobile | **Dashboard** | KPI pills, Progress card (weekly bars), calendar week view |
| 6 | Mobile | **Dashboard (onboarding)** | 18% overall, tri-segment onboarding bar, dark Onboarding Task card 2/8 |
| 7 | Mobile | **Schedule** | Vertical dashed timeline, dark/white event cards, date picker row |
| 8 | Mobile | **Profile (employee)** | Full-bleed photo, frosted Work Time bar, accordion (Devices expanded) |
| 9 | Mobile | **Profile (employee detail)** | Birthday yellow card, frosted info cards, monthly bar chart, document downloads |
| 10 | Mobile | **Profile (candidate)** | Skill tool pills, 4-state metric chips, Test Statistics dark card + line chart |
| 11 | Mobile | **People** | Card list (not table), solid-gold selected card, status dots |
| 12 | Mobile | **Hiring** | Match-rate cards, green/orange fill + hatched remainder, chat/phone icon-buttons, pagination |
| 13 | Mobile | **Salary (list)** | Employee cards, tri-segment progress bars, pagination |
| 14 | Mobile | **Salary (detail)** | Month selector, category pills (Work/Sickness/Vacation), spanning calendar events, dark event detail card + doc thumbnail |
| 15 | Mobile | **Devices** | Security gauge, Session History dark card (list variant) |
| 16 | Mobile | **Pricing** | Single featured Talent Pro card, Save-% badge, feature list, progress-step indicator |

**Parity rule:** desktop and mobile share the same token language (cream canvas, one charcoal hero, gold accent, pill nav, 4-state KPIs, hatched semantics). Layout adapts; *feel* does not.

## 7. DIRECT OBSERVATION — the real Crextio screens (20 samples, seen 6 Jul 2026)

The sponsor provided 20 actual Crextio screens (desktop Dashboard/People/Devices/Pricing + mobile variants). These are the definitive target. Concrete patterns observed — **build to these**:

**Canvas & atmosphere**
- Background is a **warm gradient, not flat cream**: light warm-grey at top → soft pale-gold (`~#F7E9B0`) toward the **bottom-right corner**. Subtle, warm, alive. (Confirms DESIGN_RESEARCH's "pale-yellow gradient in one corner" — make it a real gradient, not a flat fill.)
- Cards are white→cream, **large radii (~24px)**, **very soft shadows, zero borders**, generous padding. Calm and airy despite high density.

**The dark hero card (exactly one per screen)**
- Near-black charcoal card used for **one** focus block per view: *Onboarding Task 2/8* (dashboard — with a **stacked-cards peek** behind it), *Session History* (devices), *Test Statistics* (candidate profile), *selected calendar event detail* (salary/leave mobile). White text, gold accents inside. Never two per screen.

**Header anatomy (recurring)**
- **Left:** CREXTIO wordmark + geometric icon.
- **Center (desktop):** pill nav — Dashboard / People / Hiring / Devices / Salary / Apps / Calendar / Reviews; **dark filled segment** = active.
- **Right:** Settings pill (gear + label), notification bell (badge when unread), circular avatar.
- **Page title row:** large display heading + optional secondary pills (Directory / Org Chat / Insights) + action cluster (+, filter, Export).

**Two KPI header patterns (often co-exist on dashboard)**
1. **4-state pill row** — four metrics, each in a different fill style (see components below). Percentages are *contextual*, not fixed.
2. **Icon stat cluster** — three large numbers with icons (e.g. 78 Employees, 56 Hirings, 203 Projects). Sits beside or below the pill row on dense dashboards.

**Gold accent discipline (one meaning: "this one")**
- Gold `~#F4CB45` marks the single most important thing per context: the "Hired" KPI pill, the active time slot, progress-bar fills, the donut's primary series, checkmarks, **one** featured pricing card border, and **one** selected row/card. Everything else stays neutral.

**Signature components NOT yet fully in 05-UIUX — add them:**
1. **4-state KPI pill row.** Four metrics as pills in a row, each in a different "state" style: **black filled** (Interviews), **gold filled** (Hired), **diagonal-hatched** (Project time — "in progress"), **outline/ring** (Output). A recurring, distinctive header pattern.
2. **Diagonal-hatch texture** as a semantic fill for *in-progress / remaining / inactive / weekend* states (KPI pills, progress-bar remainder, calendar weekend cells, empty metric slots, match-rate bar tails). A signature motif — subtle diagonal lines, low contrast.
3. **Tri-segment progress bars** (Salary): **gold filled → black segment → hatched remainder**, with three numeric labels above. Used for hours/allocation.
4. **Onboarding segmented bar** (distinct from Salary tri-segment): a single track split into **labeled segments** (e.g. 30% / 25% / 0%) with vertical dividers — shows phase completion, not hour allocation.
5. **Selected row/card = FULL gold fill** (People table/cards, Salary row) — bolder than a wash. So: **hover = soft `--accent-soft` wash; selected = solid gold fill**. (Refines 05-UIUX §3.3 — distinguish hover vs selected.)
6. **Circle icon-buttons** everywhere: white circle + soft shadow for ↗ (open), chat, call, settings, +, filter, ⋯. Consistent, small, tactile.
7. **Dot-matrix mini-viz** (Attendance Report): grid of dots, gold = present / grey = absent — a compact calendar-heatmap.
8. **Metric chips** (Hiring/candidate profile): Experience / Skills / Interview / Testing as four pills reusing the 4-state styling (gold / black / hatched / grey).
9. **Match-rate bar** (Hiring mobile): horizontal bar — **green** (high match) or **orange** (medium) fill + **hatched remainder**; percentage label above (e.g. "94% Match Rate").
10. **Circular time tracker** (dashboard/profile): ring progress around elapsed time (e.g. "02:35 Work Time") with Play/Pause circle buttons.
11. **Accordion disclosure** (profile sidebar): collapsed sections with chevron; expanded section shows nested rows (e.g. Devices → MacBook Air M1). Dotted separators between sections.
12. **Vertical timeline schedule** (mobile): dashed spine, time markers as circles (black = active event, yellow = highlighted slot, white = idle), event cards branching right; small **yellow notification badge** on the spine.
13. **Spanning calendar events** (salary/leave mobile): horizontal bars across date cells (Sickness, Work days) with colored end-dot; weekends use hatched cell fill.
14. **Dark event detail card** (mobile calendar drill-down): charcoal card for selected range — title, description, amount, date range, optional **document thumbnail** with download overlay.
15. **Pricing tier cards** (admin/billing — if HRMS ever surfaces plan UI): Annual/Monthly **segmented toggle**; 3 cards — center **featured** = dark charcoal fill + **gold border** + diagonal **"Save N%"** badge; included features = green check, excluded = grey X; plan status dots (Active = yellow, Popular = green).
16. **Devices map session** (IT assets): stylized world map, **yellow pin circles** with counts per region; hover/tooltip = white card (device name, flag + city, timestamp); zoom +/- controls. Category summary cards above map (MacBook Pro · 2 items).
17. **Security gauge** (devices): semi-circular donut, big centered % (e.g. 78%), subtitle risk label ("High Risk"); gold fill on charcoal track.
18. **Circular pagination** (mobile lists): numbered circles at bottom; active page = solid white fill; inactive = translucent.
19. **Profile hero treatments:** (a) **desktop** — photo card with name/title + salary pill overlay; (b) **mobile employee** — full-bleed photo, name overlaid, **frosted-glass** info cards below; (c) **mobile candidate** — full-bleed photo + skill tool pills (Figma/Sketch/etc.) + bio paragraph.
20. **Document attachment rows** (profile): icon by file type, filename, size, circular download button.

**Charts (confirms the locked two-series palette)**
- **Weekly bar chart** (dashboard Progress card): vertical bars per weekday; **one gold bar** for peak day with floating tooltip (e.g. "5h 23m"); inactive days = hatched/outline.
- **Dotted/dashed line charts**, gold primary series + grey dashed comparison; tooltips are **small black pills** ("278 points", "Other 147").
- **Donut/ring** charts: gold + charcoal, big centered number (345 Total; 9.7 score; 78% gauge).
- **Monthly activity bars** (profile): yellow base + hatched upper portion per month.

**Tables & lists**
- Desktop People: **dotted row separators** (not solid borders), checkbox column, avatar + name, right-aligned salary numerics, flag + city for site.
- Mobile People/Hiring/Salary: **card list** with the same data fields in a 2–3 column mini-grid inside each card.
- Status pills (pastel + dot) — Paid For (lavender), Pending (green), Absent (grey), Invited (green), Hired. Always a leading dot; soft pastel bg. Matches 05-UIUX.

**Typography** — very large **light-weight display** headings ("Hello Valentina", "Welcome in, Nixtio", "People", "Salary", huge number displays like "164.35 hrs / $5,570"), clean geometric sans for UI chrome, **serif for desktop welcome only**, tabular numerals. The big-thin-heading is the premium tell.

**Navigation** — top-center **pill nav**, dark active segment (Dashboard/People/Hiring/Devices/Salary/Apps/Calendar/Reviews); Settings pill + bell + avatar on the right. Mobile sub-screens use back arrow + title + circular action buttons (chart, filter, +).

**Profiles** — rich photo cards; on mobile, **full-bleed candidate/employee photo** with name overlaid and **frosted-glass** info cards floating over it (purposeful glass — profile headers only). Birthday card = solid yellow with decorative bunting — the one playful exception.

**Mobile** — same system: KPI pills, vertical timeline schedule, dark task card with stacked-peek, calendar with hatched weekends + spanning events, full-bleed photo profiles, circular pagination. The design language is identical across desktop/mobile — exactly the parity the HRMS needs.

**Known Crextio copy quirks (do NOT replicate in HRMS):** "Employe", "Departament", "Srart date", "Vocation" (for Vacation) appear in the reference mocks — treat as designer typos.

**What this means for the HRMS:** the ATS already realizes ~90% of this (cream, charcoal hero, gold accent, pills, donuts, tabular nums). **Shipped in `frontend/src/ui/` (6 Jul 2026):** KpiPillRow, HatchFill, SegmentedProgress, IconButton, DotMatrix. **Still to land in product screens:** warm bottom-right gradient (token exists: `--canvas-glow`), solid-gold selected rows, accordion, circular time tracker, vertical timeline, spanning calendar events, match-rate bars, devices map/gauge (Phase 3 assets), pricing tier pattern (only if billing UI is in scope). Fold new primitives into 05-UIUX §5 as they are built.

## 8. How to use this doc
- When building or reviewing any HRMS screen, the check is: *does it feel like the ATS / like Crextio's calm warm editorial workspace — or like a cold admin panel?* If the latter, it's wrong.
- Concrete rules and tokens: **05-UIUX** (authoritative). This doc: the *why* and the mood.
- Optional enrichment worth doing in build: keep the **charcoal grain texture** on hero cards; consider a subtle **paper/grain** at very low opacity on the cream canvas for extra warmth (test contrast — must not reduce text legibility, firewall/accessibility rules apply).
