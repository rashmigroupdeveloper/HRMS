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
