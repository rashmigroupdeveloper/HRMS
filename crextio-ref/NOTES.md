# Crextio (Nixtio) reference notes — inspiration only, assets not reused
Source: nixtio.com/cases/crextio (36 case images downloaded here, crextio-*.webp), Dribbble shots 25846869 / 25582953.
Palette (Dribbble): #E6A434 #F5D175 gold · #0A0807 charcoal · #F0ECDD/#EBE7D7 cream · #A8A49E grey.

Observed patterns vs our build (before shots /workspace/STATE/screens/before):
1. Canvas: cool grey top-left -> warm yellow glow bottom-right. Ours matches (body::before glow). OK.
2. Headline numerals: huge LIGHT-weight unboxed numbers (78 / 56 / 203) with tiny icon + label. Ours used small semibold pills -> added ui/HeadlineStats (HR ops header).
3. Card actions: round ↗ icon button top-right of every card. Ours used bare "Open" text -> added ui/CardLink.
4. Labels sentence case, small, muted — no uppercase tracked kickers. Removed 22 files of uppercase/tracking kickers + table headers.
5. Pill nav with dark active pill + round icon buttons right: ours matches.
6. One dark card per screen (Onboarding Task / Attendance Report): ours matches (DarkCard).
7. Segmented progress strip (dark / gold / hatched / outline) under greeting — candidate for attendance mix widget (TODO).
8. Dot-matrix attendance chart in dark card — candidate for manager/HR attendance widget (TODO).
9. Headings: light sans (~300) large; ESS greeting still serif — spec allows Fraunces on greeting only.

2026-11-28, ESS home (/ess) — taken further (taste rules in TASTE.md):
10. Profile card -> HomeMe: one's own photo (verified PHOTO document, else one's own copy waiting for HR) full-bleed,
    fading to warm brown, name / job / "since" / code pill over it; no photo = initials on a warm gradient + "Add your photo".
11. Time tracker ring -> HomeToday: thick 10px track and gold arc, dotted outer scale.
12. Capsule bars -> HomeWeek: each day a full-height striped capsule filled to its hours.
13. Segmented strip -> HomeLeave: taken / waiting / left under each leave type (item 7 done here).
14. Birthday card -> HomeHolidays: the next holiday as a soft-gold card with the date big.
15. Onboarding Task dark card -> HomeMyRequests: round status chips and the "1/2 waiting" count; charcoal only when no
    other tile on the screen is dark.
