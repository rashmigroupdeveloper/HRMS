# 12 — Visual Reference: Crextio / Nixtio & the Warm Editorial Lane

**Purpose:** capture the *feel* the sponsor is after — deeper than hex codes — as a mood/reference companion to 05-UIUX. **This does NOT change the token law** (05-UIUX §0.1 firewall stands): the ATS tokens remain authoritative. This doc explains the *why* and *atmosphere* behind them, adds current (2026) validation, and gives a curated mood board so future UI work stays on-feel.

**Research date:** 5 Jul 2026. Note: Dribbble/Nixtio image assets are bot-walled to scripts; the concrete visual values below come from (a) the ATS's own realized tokens + `DESIGN_RESEARCH.md` + `Ui analysis.md`, and (b) verified 2026 design-trend sources. The single best reference for "what the user wants" is **the ATS itself** — it already realizes this aesthetic.

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
- **Type:** Manrope, big light-weight display headings ("Hello Rachna"), tabular numerals.
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

## 7. DIRECT OBSERVATION — the real Crextio screens (14 samples, seen 5 Jul 2026)

The sponsor provided 14 actual Crextio screens (desktop Dashboard/Salary/Hiring/People/Devices + mobile). These are the definitive target. Concrete patterns observed — **build to these**:

**Canvas & atmosphere**
- Background is a **warm gradient, not flat cream**: light warm-grey at top → soft pale-gold (`~#F7E9B0`) toward the **bottom-right corner**. Subtle, warm, alive. (Confirms DESIGN_RESEARCH's "pale-yellow gradient in one corner" — make it a real gradient, not a flat fill.)
- Cards are white→cream, **large radii (~24px)**, **very soft shadows, zero borders**, generous padding. Calm and airy despite high density.

**The dark hero card (exactly one per screen)**
- Near-black charcoal card used for **one** focus block per view: *Attendance Report* (dashboard), *Onboarding Task 2/8* (with a stacked-cards peek behind it), *Session History* (devices), *Test Statistics* (profile). White text, gold accents inside. Never two per screen.

**Gold accent discipline (one meaning: "this one")**
- Gold `~#F4CB45` marks the single most important thing per context: the "Hired" KPI pill, the active time slot (12:00), progress-bar fills, the donut's primary series, checkmarks, and **one** feature card (Job Match 95%). Everything else stays neutral.

**Signature components NOT yet fully in 05-UIUX — add them:**
1. **4-state KPI pill row.** Four metrics as pills in a row, each in a different "state" style: **black filled** (Interviews 70%), **gold filled** (Hired 10%), **diagonal-hatched** (Project time — "in progress"), **outline/ring** (Output — small circle). A recurring, distinctive header pattern.
2. **Diagonal-hatch texture** as a semantic fill for *in-progress / remaining / inactive / weekend* states (KPI pills, progress-bar remainder, calendar weekend cells, empty metric slots). A signature motif — subtle diagonal lines, low contrast.
3. **Tri-segment progress bars** (Salary): **gold filled → black segment → hatched remainder**, with three numeric labels above. Used for hours/allocation.
4. **Selected row = FULL gold fill** (People table, Salary row) — bolder than a wash. So: **hover = soft `--accent-soft` wash; selected = solid gold fill**. (Refines 05-UIUX §3.3 — distinguish hover vs selected.)
5. **Circle icon-buttons** everywhere: white circle + soft shadow for ↗ (open), chat, call, settings, +, filter, ⋯. Consistent, small, tactile.
6. **Dot-matrix mini-viz** (Attendance Report): grid of dots, gold = present / grey = absent — a compact calendar-heatmap.
7. **Metric chips** (Hiring): Experience/Skills/Interview/Testing as four pills reusing the 4-state styling (gold / black / hatched / grey).

**Charts (confirms the locked two-series palette)**
- **Dotted/dashed line charts**, gold primary series + grey dashed comparison; tooltips are **small black pills** ("Other 147", "294 points").
- **Donut/ring** charts: gold + charcoal, big centered number (345 Total; 9.7 score; 78% gauge).

**Status pills (pastel + dot)** — Paid For (lavender), Pending (green), Absent (grey), Invited (green), Hired. Always a leading dot; soft pastel bg. Matches 05-UIUX.

**Typography** — very large **light-weight display** headings ("Hello Valentina", "Salary", "People", huge number displays like "264.00 hrs / $2,647"), clean geometric sans, tabular numerals. The big-thin-heading is the premium tell.

**Navigation** — top-center **pill nav**, dark active segment (Dashboard/People/Hiring/Devices/Salary/Apps/Calendar/Reviews); Settings pill + bell + avatar on the right.

**Profiles** — rich photo cards; on mobile, **full-bleed candidate photo** with name overlaid and **frosted-glass** info cards floating over it (one of the few *purposeful* glass uses — profile headers only).

**Mobile** — same system: KPI pills, vertical timeline schedule, dark task card with stacked-peek, calendar with hatched weekends, full-bleed photo profiles. The design language is identical across desktop/mobile — exactly the parity the HRMS needs.

**What this means for the HRMS:** the ATS already realizes ~90% of this (cream, charcoal hero, gold accent, pills, donuts, tabular nums). The **enrichments to make sure land**: the warm bottom-right gradient, the 4-state KPI pill row, the diagonal-hatch semantic texture, tri-segment progress bars, solid-gold selected rows, circle icon-buttons, and the dot-matrix mini-viz. These are folded into 05-UIUX §5 (component inventory).

## 8. How to use this doc
- When building or reviewing any HRMS screen, the check is: *does it feel like the ATS / like Crextio's calm warm editorial workspace — or like a cold admin panel?* If the latter, it's wrong.
- Concrete rules and tokens: **05-UIUX** (authoritative). This doc: the *why* and the mood.
- Optional enrichment worth doing in build: keep the **charcoal grain texture** on hero cards; consider a subtle **paper/grain** at very low opacity on the cream canvas for extra warmth (test contrast — must not reduce text legibility, firewall/accessibility rules apply).
