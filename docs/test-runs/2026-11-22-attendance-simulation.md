# Attendance simulation - 2026-11-22

The tester asked for a month's attendance of two employees with different shifts, weekly offs and punch times, one of
them changing shift mid-month and a roster in the middle, watched in an open browser, noting every bug.

Period: the attendance month November 2026 = **26 Oct - 21 Nov** (the month runs 26th-25th; today is 22 Nov).

## Setup (all through the app as Super Admin, except step 1)

| # | Step | Result |
|---|---|---|
| 1 | Cleaned the old attendance data (Prisma, so the change history records it): 100 day results, 6 punches, 1 upload, 14 roster days; no corrections, shift changes or locks. Shifts, policies, lines and holidays kept | done |
| 2 | Setup > Shifts: **Morning (M) 06:00-14:00**, first half to 10:00, break 30; **Evening (E) 14:00-22:00**, first half to 18:00 | OK |
| 3 | Setup > Policies: **Plant** - grace 10, full day = whole shift, half 4h, every 3rd late = first half absent, in > 120 min late / out > 120 min early = that half absent | OK - list said "every 3th late" (**B1**) |
| 4 | Setup > Holidays: **Mon 9 Nov "Test holiday (simulation)"**, every company | OK |
| 5 | People > Employee records > Add employee: **Kiran Patel RML090008** (IT, joined 01-10-2026) and **Meera Iyer RML090009** (HR, joined 01-10-2026) | OK |
| 6 | Setup > Default shifts: Kiran **Morning, off Fri, Plant** from 01-10; Meera **General, off Sun, Sat half day, Standard** from 01-10 and **Evening, off Sun, no half day** from **11-11** (day 17 of the month) | OK - the screen does not show anyone's current lines (**S1**) |
| 7 | Setup > Punches: one CSV, 86 punches (generated with the expected result of every day - scratchpad `e2e/sim_punches.py`) | 86 added |
| 8 | Roster > Everyone > Kiran: 17-19 Nov General, 20 Nov (his Friday off) General, 21 Nov Off > Publish 5 draft days | OK - the default choice and the real shift both read "M" (**S2**) |

## Result: 54 days compared with what they should be - 0 mismatches

Kiran (Morning, off Friday, Plant): on time, in the grace (not late), 1st/2nd late, **3rd late -> first half absent**
(note "3rd late this month - first half absent"), 4th/5th late, **6th late -> penalty**, left at 12:30 (half day,
morning), one punch (MP), no punch (A), very late 2h45m (first half absent), very early 2h30m (second half absent), worked
on the Friday off (WO, hours kept), worked on the holiday (H), 3h30m (absent); **roster days**: General with a full 9h (P),
General 8h40m (afternoon half), General no punch (A), **General on his Friday off (working day, P)**, **Off on a Saturday
(WO)**.

Meera (General -> Evening on 11 Nov): exactly 9h (P), 8h50m (afternoon half), left 13:30 (morning half), MP, **Saturday
4h05m (P/WO)**, **Saturday 3h30m (A/WO)**, worked on the Sunday off, holiday; **after the change**: Evening on time (P),
7h40m (second half), Saturday a whole day on the new line (P), **punched at the old General times (09:00 is outside the
Evening window -> MP)**, 5h25m (first half).

Muster totals checked by hand (Kiran: 15 present, 6 half days, 6 absent - counted in halves). Shots: `sim-muster`,
`sim-meera-16`.

## Bugs

| # | Bug | Status |
|---|---|---|
| B1 | Policies list: "every 3th late" | **fixed** - "every 3rd late" |
| B2 | A missed-punch day showed late minutes from its single punch (Meera 16 Nov "+230m MP", and the muster's late mark) | **fixed** - late / early only with both punches |
| B3 | A punch outside every shift window belongs to no day and is shown nowhere (Meera's 09:00 on 16 Nov) - HR cannot see why the day is a missed punch | **open** - proposal below |
| B4 | The month calendar's legend still had "HD Half day" (half days show as P \| A) | **fixed** |

## Suggestions

| # | Suggestion | Status |
|---|---|---|
| S1 | Default shifts: show each chosen employee's current line (shift, offs, half days, policy, from) | open |
| S2 | Roster dropdown: the default choice and the real shift read the same ("M", "M") - a native dropdown cell shows the chosen text, so "M (default)" would widen every cell; needs a small custom dropdown | open |
| S3 | Very late / very early: the note is now written even when the half was absent anyway ("In 2h 45m late - first half absent") | **done** |
| S4 | Work on a weekly off / holiday is only recorded (hours) - comp-off / overtime come with the Leave / Payroll modules | later |

## Recommended way to test attendance

1. **A scripted scenario with expected results** (as done here): one file lists each employee, day, punches and the
   expected halves; a script uploads, then compares every day. Repeatable after every change; worth keeping as
   `backend/scripts/simulate-attendance.ts` (one-off task) or as a test.
2. **Never clean the real data - use test people**: a test company / plant ("TEST") with its own employees, or the test
   database (`*_test`); then no "clean all attendance" step is needed and other people's days are untouched.
3. **A database snapshot before a big test** (`pg_dump` / restore) to go back in one step.
4. **Test the edges on purpose**: month boundaries (25th/26th), a shift change on the first day of a line, night shifts
   across midnight, a locked month, punches uploaded twice, punches before joining.
5. **Watch in the browser only the key screens** (muster, one month, one day) - compare the rest by script.
