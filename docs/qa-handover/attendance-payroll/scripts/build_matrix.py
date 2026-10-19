#!/usr/bin/env python3
"""Builds scenario-matrix.json — the attendance→payroll scenario matrix (handover item 4).

Expected values are computed HERE, independently of the backend engine, from the written
policy (docs/04 §3, docs/10, Payment of Gratuity Act, EPF/ESI/WB PT/Income-tax rules), and each
case carries its derivation. The backend test tests/payroll-scenario-matrix.integration.test.ts
builds each case as a synthetic company in a rolled-back transaction, runs the real services
(month window → locked day facts → payroll run compute / gratuity / F&F) and compares.

Run: python3 build_matrix.py  (rewrites scenario-matrix.json next to this file)
"""
import json, datetime as dt
from decimal import Decimal, ROUND_HALF_UP, ROUND_CEILING
from pathlib import Path

D = Decimal
def r(x):  # nearest rupee, half up
    return int(D(x).quantize(D(1), ROUND_HALF_UP))

WB_PT = [(0, 10000, 0), (10000.01, 15000, 110), (15000.01, 25000, 130), (25000.01, 40000, 150), (40000.01, None, 200)]
def pt(gross):
    if gross <= 0: return 0
    for lo, hi, amt in WB_PT:
        if gross >= lo and (hi is None or gross <= hi): return amt
    return 0

def slab_tax(taxable, slabs):  # rupees, per-slab rounding in paise like any paise engine
    tax = 0
    for lo, hi, rate in slabs:
        if taxable > lo:
            part = min(taxable, hi) - lo
            if part > 0 and rate: tax += D(part) * D(rate) / 100
    return D(tax)

NEW = [(0, 400000, 0), (400000, 800000, 5), (800000, 1200000, 10), (1200000, 1600000, 15), (1600000, 2000000, 20), (2000000, 2400000, 25), (2400000, 10**12, 30)]
OLD = [(0, 250000, 0), (250000, 500000, 5), (500000, 1000000, 20), (1000000, 10**12, 30)]

def tax_new(t):
    if t <= 0: return D(0)
    base = slab_tax(t, NEW)
    if t <= 1200000: base = max(D(0), base - min(base, D(60000)))      # s.87A (Budget 2025)
    else: base = min(base, D(t - 1200000))                              # marginal relief over ₹12L
    sur = D(0)
    for th, pct in [(20000000, 25), (10000000, 15), (5000000, 10)]:
        if t > th:
            sur = base * pct / 100; break
    return (base + sur) * D('1.04')

def tax_old(t):
    if t <= 0: return D(0)
    base = slab_tax(t, OLD)
    if t <= 500000: base = max(D(0), base - min(base, D(12500)))
    sur = D(0)
    for th, pct in [(50000000, 37), (20000000, 25), (10000000, 15), (5000000, 10)]:
        if t > th:
            sur = base * pct / 100
            at = slab_tax(th, OLD)
            ceiling = at + (D(t) - th)   # threshold bands below 1Cr carry no lower surcharge in these cases
            if base + sur > ceiling: sur = max(D(0), ceiling - base)
            break
    return (base + sur) * D('1.04')

def payroll(case):
    s = case['salary']; days = case['expect']['payable_days']; div = case['expect']['days_in_month']
    earned = {k: (v if days >= div else r(D(v) * D(str(days)) / D(div))) for k, v in s.items()}
    gross = sum(earned.values())
    ot = 0
    if case.get('otMinutes'):
        ot = r(D(s['BASIC']) * case['otMinutes'] * 2 / (208 * 60)); gross += ot
    basic = earned.get('BASIC', 0)
    pfb = case['employee'].get('pfBasis', 'ACTUAL')
    pf_base = min(basic, 15000) if pfb == 'CEILING_15000' and not case['employee'].get('iw') else basic  # REQ-003: no ceiling for international workers
    pf = r(D(pf_base) * 12 / 100) if basic > 0 else 0
    esi = 0
    if case['employee'].get('esic'):
        start_gross = sum(case.get('salaryAtPeriodStart', s).values())
        if start_gross <= 21000: esi = int((D(gross - ot) * D('0.0075')).quantize(D(1), ROUND_CEILING))
    p = pt(gross)
    contracted = sum(s.values())
    regime = case['employee'].get('regime', 'new')
    if regime == 'new':
        annual_tax = tax_new(contracted * 12 - 75000)
    else:
        via = sum(min(d['amount'], {'80C': 150000}.get(d['section'].upper(), d['amount'])) for d in case.get('declarations', []))
        annual_tax = tax_old(contracted * 12 - 50000 - pt(contracted) * 12 - via)
    tds = r(annual_tax / 12 * D(str(min(days, div))) / D(div))
    net = gross - pf - esi - p - tds
    return dict(gross=gross, PF_EE=pf, ESI_EE=esi, PT=p, TDS=tds, net=net)

S30 = {'BASIC': 15000, 'HRA': 7500, 'SPECIAL_ALLOW': 7500}
S25 = {'BASIC': 25000, 'HRA': 12500, 'SPECIAL_ALLOW': 12500}

def P(cid, title, derivation, payable, div=30, month='2026-06-01', salary=S30, settings=None, employee=None, days=None, **extra):
    c = dict(id=cid, kind='payroll', title=title, derivation=derivation, month=month, settings=settings or {},
             employee=employee or {}, salary=salary, days=days or {}, expect=dict(days_in_month=div, payable_days=payable))
    c.update(extra)
    c['expect'].update(payroll(c))
    return c

cases = [
 P('M01', 'Full month present (calendar divisor)', 'June 30 days, Sundays paid WO; 30/30; PF 12% of 15000; WB PT 150 (25k–40k)', 30),
 P('M02', 'Two unexcused absences', 'A on Tue 2 and Wed 3 Jun → 28/30; each component × 28/30', 28, days={'2026-06-02': 'A', '2026-06-03': 'A'}),
 P('M03', 'Half day (worked half, no leave)', 'HD Thu 4 Jun → 0.5 LOP → 29.5/30', 29.5, days={'2026-06-04': 'HD'}),
 P('M04', 'Half-day paid CL + other half worked', 'HD with CL, session 1 P → leave half paid + worked half paid → 30/30 (was 29.5 before item 4)', 30, days={'2026-06-04': 'HD:CL:worked'}),
 P('M05', 'Half-day paid CL, other half not worked', 'HD with CL, no punches → 0.5 paid leave + 0.5 LOP → 29.5/30', 29.5, days={'2026-06-04': 'HD:CL'}),
 P('M06', 'Half-day LWP + other half worked', 'HD with LWP, session 1 P → worked half paid, LWP half unpaid → 29.5/30', 29.5, days={'2026-06-04': 'HD:LWP:worked'}),
 P('M07', 'Half-day LWP, other half not worked', 'HD with LWP and no punches → full day unpaid → 29/30', 29, days={'2026-06-04': 'HD:LWP'}),
 P('M08', 'Forfeited week-off + LWP day', 'WO Sun 7 Jun unpaid (ATT-09 forfeiture) + LWP Mon 8 Jun → 28/30', 28, days={'2026-06-07': 'WO:unpaid', '2026-06-08': 'L:LWP'}),
 P('M09', 'Three days paid CL', 'L:CL 9–11 Jun are paid → 30/30', 30, days={'2026-06-09': 'L:CL', '2026-06-10': 'L:CL', '2026-06-11': 'L:CL'}),
 P('M10', 'Paid holiday', 'H Mon 15 Jun is paid → 30/30', 30, days={'2026-06-15': 'H'}),
 P('M11', 'Joiner on 16 Jun (calendar)', 'Employed 16–30 Jun = 15 days → 15/30; PT slab 10k–15k = 110', 15, employee={'doj': '2026-06-16'}),
 P('M12', 'Leaver LWD 20 Jun (calendar)', 'Employed 1–20 Jun = 20 days → 20/30; PT 130', 20, employee={'dol': '2026-06-20', 'status': 'on_notice'}),
 P('M13', 'Sandwich rule OFF', 'A Sat 6 + A Mon 8, Sun 7 paid WO → 28/30', 28, days={'2026-06-06': 'A', '2026-06-08': 'A'}),
 P('M14', 'Sandwich rule ON: WO between two absences', 'att.sandwich_rule=true: Sun 7 between A Sat 6 and A Mon 8 becomes LOP → 27/30', 27, settings={'att.sandwich_rule': True}, days={'2026-06-06': 'A', '2026-06-08': 'A'}),
 P('M15', 'Sandwich rule ON: present on one side', 'A Sat 6, P Mon 8 → no sandwich → 29/30', 29, settings={'att.sandwich_rule': True}, days={'2026-06-06': 'A'}),
 P('M16', 'Sandwich rule ON: holiday + WO run between LWP days', 'LWP Fri 12, H Sat 13, WO Sun 14, LWP Mon 15 → 2 LWP + 2 sandwiched → 26/30', 26, settings={'att.sandwich_rule': True}, days={'2026-06-12': 'L:LWP', '2026-06-13': 'H', '2026-06-15': 'L:LWP'}),
 P('M17', 'FIXED_30 divisor in a 31-day month', 'pay.lop_divisor=FIXED_30, July: 30 − 2 A = 28/30', 28, month='2026-07-01', settings={'pay.lop_divisor': 'FIXED_30'}, days={'2026-07-07': 'A', '2026-07-08': 'A'}),
 P('M18', 'CALENDAR divisor in a 31-day month', 'July 31 days, 2 A → 29/31; BASIC 15000×29/31 = 14032.26 → 14032', 29, div=31, month='2026-07-01', days={'2026-07-07': 'A', '2026-07-08': 'A'}),
 P('M19', 'FIXED_30 joiner in a 31-day month', 'DOJ 16 Jul: 15 days of July outside employment → 30 − 15 = 15/30', 15, month='2026-07-01', settings={'pay.lop_divisor': 'FIXED_30'}, employee={'doj': '2026-07-16'}),
 P('M20', 'FIXED_26 full month', 'June working days = 30 − 4 Sundays = 26 → 26/26', 26, div=26, settings={'pay.lop_divisor': 'FIXED_26'}),
 P('M21', 'FIXED_26 with two absences', '26 − 2 = 24/26; BASIC 15000×24/26 = 13846.15 → 13846', 24, div=26, settings={'pay.lop_divisor': 'FIXED_26'}, days={'2026-06-02': 'A', '2026-06-03': 'A'}),
 P('M22', 'FIXED_26 joiner on 16 Jun', 'Working days 1–15 Jun outside employment = 15 − 2 Sundays = 13 → 26 − 13 = 13/26', 13, div=26, settings={'pay.lop_divisor': 'FIXED_26'}, employee={'doj': '2026-06-16'}),
 P('M23', 'WORKING_DAYS divisor with a company holiday', 'Holiday Mon 15 Jun (company calendar): working days 30 − 4 − 1 = 25; 1 A → 24/25', 24, div=25, settings={'pay.lop_divisor': 'WORKING_DAYS'}, days={'2026-06-15': 'H', '2026-06-02': 'A'}, holidays=[{'date': '2026-06-15', 'scope': 'company'}]),
 P('M24', '26–25 cycle: LOP in both months of the window', 'att.cycle_start_day=26: June window 26 May–25 Jun; A 28 May + A 10 Jun → 28/30; 26–30 Jun assumed present', 28, settings={'att.cycle_start_day': 26}, days={'2026-05-28': 'A', '2026-06-10': 'A'}),
 P('M25', '26–25 cycle: absence after the cut-off', 'A on 27 Jun is outside the June window (counted in July) → 30/30', 30, settings={'att.cycle_start_day': 26}, afterCutoff={'2026-06-27': 'A'}),
 P('M26', '26–25 cycle: joiner after the cut-off', 'DOJ 27 Jun: employed 27–30 Jun, no window facts → 4/30; PT 0 (≤10k)', 4, settings={'att.cycle_start_day': 26}, employee={'doj': '2026-06-27'}),
 P('M27', '26–25 cycle: leaver inside the window', 'LWD 20 Jun: employed 1–20 Jun (20 days); window facts 26 May–20 Jun with A on 27 May → 19/30', 19, settings={'att.cycle_start_day': 26}, employee={'dol': '2026-06-20', 'status': 'on_notice'}, days={'2026-05-27': 'A'}),
 P('M28', 'PF on ceiling wages (₹15,000)', 'BASIC 25000, pf_wage_basis CEILING_15000 → PF 1800; gross 50000 → PT 200; new regime taxable 5.25L ≤ 12L → 87A → TDS 0', 30, salary={'BASIC': 25000, 'HRA': 12500, 'SPECIAL_ALLOW': 12500}, employee={'pfBasis': 'CEILING_15000'}, extraExpect={'EPS_ER': 1250, 'PF_ER': 550}),
 P('M29', 'PF on actual wages', 'Same pay, ACTUAL → PF 12% × 25000 = 3000; EPS capped 1250; ER EPF 1750', 30, salary={'BASIC': 25000, 'HRA': 12500, 'SPECIAL_ALLOW': 12500}, employee={'pfBasis': 'ACTUAL'}, extraExpect={'EPS_ER': 1250, 'PF_ER': 1750}),
 P('M30', 'ESIC covered at exactly ₹21,000', 'Gross 21000 ≤ ceiling → ESI EE 0.75% = 157.50 → 158 (rounded up); ER 3.25% = 682.50 → 683', 30, salary={'BASIC': 10500, 'HRA': 5250, 'SPECIAL_ALLOW': 5250}, employee={'esic': True}, extraExpect={'ESI_ER': 683}),
 P('M31', 'ESIC gate: ₹21,001 not covered', 'Gross 21001 > ₹21,000 at period start → no ESIC', 30, salary={'BASIC': 10500, 'HRA': 5250, 'SPECIAL_ALLOW': 5251}, employee={'esic': True}),
 P('M32', 'ESIC continues for the contribution period after a raise', 'Covered at 1 Apr (gross 20000); raised to 24000 from 1 Jun → still covered until 30 Sep: ESI 0.75% × 24000 = 180', 30, salary={'BASIC': 12000, 'HRA': 6000, 'SPECIAL_ALLOW': 6000}, employee={'esic': True}, salaryAtPeriodStart={'BASIC': 10000, 'HRA': 5000, 'SPECIAL_ALLOW': 5000}),
 P('M33', 'WB PT nil up to ₹10,000', 'Gross 10000 → PT 0', 30, salary={'BASIC': 5000, 'HRA': 2500, 'SPECIAL_ALLOW': 2500}),
 P('M34', 'WB PT on earned (not contracted) gross', 'Contracted 30000, 14/30 payable → earned 14000 → PT 110', 14, days={f'2026-06-{d:02d}': 'A' for d in [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18]}),
 P('M35', 'TDS new regime above ₹12L', 'Annual 15L − 75k SD = 14.25L: 20000 + 40000 + 33750 = 93750 + 4% cess = 97500 → 8125/month', 30, salary={'BASIC': 62500, 'HRA': 31250, 'SPECIAL_ALLOW': 31250}),
 P('M36', 'TDS new regime marginal relief just above ₹12L', 'Taxable 12.15L: slab tax 62250 capped at excess 15000 + cess 600 = 15600 → 1300/month', 30, salary={'BASIC': 53750, 'HRA': 26875, 'SPECIAL_ALLOW': 26875}),
 P('M37', 'TDS old regime with 80C capped', 'Old regime: 12L − 50k SD − PT 2400 − 80C 1.5L (declared 2L) = 9,97,600 → 112020 + cess = 116500.80 → 9708/month', 30, salary={'BASIC': 50000, 'HRA': 25000, 'SPECIAL_ALLOW': 25000}, employee={'regime': 'old'}, declarations=[{'section': '80C', 'amount': 200000}]),
 P('M38', 'TDS old regime surcharge above ₹50L', 'Old regime: 60L − 50k − 2400 = 59,47,600 → slab 1596780 + 10% surcharge 159678 + 4% cess → 1826716.32 → 152226/month', 30, salary={'BASIC': 250000, 'HRA': 125000, 'SPECIAL_ALLOW': 125000}, employee={'regime': 'old'}),
 P('M39', 'Approved overtime (Basic/208 × 2)', '240 approved minutes: 15000/208 × 2 × 4 h = 576.92 → 577; PF on BASIC only', 30, otMinutes=240),
 # REQ-003 / RQ-JF-014 EPS membership (Form 11). Pay 25000/12500/12500 → gross 50000, PT 200, TDS 0 (87A).
 # EPS is a split of the employer 12%, so net pay never moves: PF_ER + EPS_ER = 12% of the employer PF base.
 P('M41', 'EPS: fresh member after Sep-2014 above ₹15,000', 'Form 11 "not an earlier member", joined 2020 on BASIC 25000 > 15000 → no EPS; ER EPF 12% × 25000 = 3000; net 46800 as M29', 30, salary=S25, employee={'pfBasis': 'ACTUAL', 'memberBefore2014': False}, extraExpect={'EPS_ER': 0, 'PF_ER': 3000}),
 P('M42', 'EPS: member before Sep-2014 keeps EPS', 'Form 11 "member before 01-09-2014" = Y, same pay → EPS 8.33% × 15000 = 1250; ER EPF 3000 − 1250 = 1750', 30, salary=S25, employee={'pfBasis': 'ACTUAL', 'memberBefore2014': True}, extraExpect={'EPS_ER': 1250, 'PF_ER': 1750}),
 P('M43', 'EPS: first enrolled within the ceiling, raised later', 'Form 11 first enrolment 2019-04-01 on PF wages 12000 ≤ 15000 → EPS member for life; EPS wages capped 15000 → 1250; ER EPF 1750', 30, salary=S25, employee={'pfBasis': 'ACTUAL', 'memberBefore2014': False, 'firstEnrolledOn': '2019-04-01', 'firstWages': 12000}, extraExpect={'EPS_ER': 1250, 'PF_ER': 1750}),
 P('M44', 'EPS: turns 58 during the pay month', 'DOB 15-06-1968 → 58 on 15 Jun 2026, after 1 Jun → June is the last EPS month (CD-P8) → 1250', 30, salary=S25, employee={'pfBasis': 'ACTUAL', 'dob': '1968-06-15'}, extraExpect={'EPS_ER': 1250, 'PF_ER': 1750}),
 P('M45', 'EPS: stops after 58', 'DOB 20-05-1968 → 58 before 1 Jun 2026 → no EPS; whole ER 12% = 3000 to EPF; employee PF continues 3000', 30, salary=S25, employee={'pfBasis': 'ACTUAL', 'dob': '1968-05-20'}, extraExpect={'EPS_ER': 0, 'PF_ER': 3000}),
 P('M46', 'International worker: no PF wage ceiling', 'Company basis CEILING_15000 but international worker → PF on full 25000: EE 3000; EPS wages still capped 15000 → 1250; ER EPF 1750; net 46800', 30, salary=S25, employee={'pfBasis': 'CEILING_15000', 'iw': True}, extraExpect={'EPS_ER': 1250, 'PF_ER': 1750}),
 P('M47', 'EPS: HR decision overrides (no EPS within ceiling)', 'eps_eligible = false (e.g. EPS withdrawn / pensioner): BASIC 15000 → EPS 0, ER EPF 1800', 30, employee={'epsEligible': False}, extraExpect={'EPS_ER': 0, 'PF_ER': 1800}),
 P('M48', 'EPS: no Form 11 data keeps EPS', 'Joined 2021 on BASIC 25000 but Form 11 not captured → EPS kept (existing cohort default) → 1250 / 1750', 30, salary=S25, employee={'pfBasis': 'ACTUAL', 'doj': '2021-03-01'}, extraExpect={'EPS_ER': 1250, 'PF_ER': 1750}),
 P('M40', 'TDS prorated for LOP', 'New regime 15L case with 2 A: TDS 97500/12 × 28/30 = 7583.33 → 7583', 28, salary={'BASIC': 62500, 'HRA': 31250, 'SPECIAL_ALLOW': 31250}, days={'2026-06-02': 'A', '2026-06-03': 'A'}),
]
for c in cases:
    c['expect'].update(c.pop('extraExpect', {}))

cases += [
 dict(id='W01', kind='window', title='Cycle switch 1 → 26 continues from the last lock', derivation='May locked as calendar month (1 May–1 Jun); cycle now 26 → June window 1 Jun–26 Jun (no overlap)',
      settings={'att.cycle_start_day': 26}, previousLock={'month': '2026-05-01', 'from': '2026-05-01', 'until': '2026-06-01'}, month='2026-06-01', expect={'from': '2026-06-01', 'until': '2026-06-26'}),
 dict(id='W02', kind='window', title='Cycle switch 26 → 1 continues from the last lock', derivation='May locked 26 Apr–26 May; cycle now 1 → June window 26 May–1 Jul (no gap)',
      settings={'att.cycle_start_day': 1}, previousLock={'month': '2026-05-01', 'from': '2026-04-26', 'until': '2026-05-26'}, month='2026-06-01', expect={'from': '2026-05-26', 'until': '2026-07-01'}),
 dict(id='W03', kind='window', title='26–25 cycle without a previous lock', derivation='cycle 26, no May lock → nominal 26 May–26 Jun', settings={'att.cycle_start_day': 26}, month='2026-06-01', expect={'from': '2026-05-26', 'until': '2026-06-26'}),
 dict(id='H01', kind='holiday', title='Holiday calendars: group, company, plant, location', derivation='A row applies when every non-null scope column matches the employee',
      holidays=[{'date': '2026-08-15', 'scope': 'group'}, {'date': '2026-10-20', 'scope': 'company'}, {'date': '2026-11-08', 'scope': 'plant'}, {'date': '2026-12-01', 'scope': 'location'}],
      expect={'inPlant': ['2026-08-15', '2026-10-20', '2026-11-08', '2026-12-01'], 'samCompanyOtherPlantOtherLocation': ['2026-08-15', '2026-10-20'], 'otherCompany': ['2026-08-15']}),
 dict(id='G01', kind='gratuity', title='Gratuity at exactly 5 years', derivation='15 × 30000 × 5 / 26 = 86538.46 → 86538', basic=30000, doj='2021-06-01', lwd='2026-05-31', expect={'eligible': True, 'years': 5, 'gratuity': 86538}),
 dict(id='G02', kind='gratuity', title='Gratuity below 4 years 240 days', derivation='1 Dec 2021–31 May 2026 = 4y 5m (1643 days) < 4y 240d (1700 days) → nil', basic=30000, doj='2021-12-01', lwd='2026-05-31', expect={'eligible': False, 'years': 4, 'gratuity': 0}),
 dict(id='G03', kind='gratuity', title='Gratuity 4y 9m rounds to 5 years', derivation='1734 days ≥ 1700 eligible; 9 months ≥ 6 → 5 years → 86538', basic=30000, doj='2021-09-01', lwd='2026-05-31', expect={'eligible': True, 'years': 5, 'gratuity': 86538}),
 dict(id='G04', kind='gratuity', title='Gratuity capped at ₹20 lakh', derivation='15 × 500000 × 30 / 26 = 86,53,846 → cap 20,00,000', basic=500000, doj='1996-06-01', lwd='2026-05-31', expect={'eligible': True, 'years': 30, 'gratuity': 2000000}),
 dict(id='F01', kind='fnf', title='F&F: salary, EL encashment, notice recovery, gratuity', derivation='50000/30×20 = 33333.33; EL 30000/30×15 = 15000; notice 30000/30×10 = 10000; gratuity 6y11m → 7y: 15×30000×7/26 = 121153.85 → 121154; net 159487',
      params={'basic': 30000, 'gross': 50000, 'daysPayable': 20, 'elBalanceDays': 15, 'shortfallDays': 10, 'doj': '2019-07-01', 'lwd': '2026-06-20'}, expect={'gratuity': 121154, 'leaveEncashment': 15000, 'noticeRecovery': 10000, 'net': 159487}),
]

# ── Kent feed end to end (owner bar #2): simulator punches → adapter → ingest/dedupe → day
# status → no-swipe days materialised → week close → month lock → muster → payroll.
# Shift used by these cases: 09:00–18:00, unpaid break 60 min, full day ≥ 8 h, half day ≥ 4 h.
KENT_SHIFT = {'start': '09:00', 'end': '18:00', 'break': 60, 'full': 8, 'half': 4}
PATTERNS = {  # pattern → punches [(device, HH:MM)], all FILO on the same day
    'P':     [('G1', '09:02'), ('G1', '18:05')],          # 543 − 60 = 483 ≥ 480 → P
    'P2':    [('G1', '08:55'), ('G2', '18:01')],          # in at one door, out at another: 546 − 60 = 486 → P
    'HD':    [('G1', '09:00'), ('G1', '14:00')],          # 300 − 60 = 240 ≥ 240 → HD
    'SHORT': [('G1', '09:00'), ('G1', '12:30')],          # 210 − 60 = 150 < 240 → A
    'IN':    [('G1', '09:00')],                           # single punch, no out → A
    'DUP':   [('G1', '09:02'), ('G1', '18:05')],          # P, every punch delivered twice → deduped
    'LATE':  [('G1', '09:02'), ('G1', '18:05')],          # P, buffered by the device, arrives in the 2nd sync
    'NONE':  [],
}
def kstatus(pattern):
    pts = PATTERNS[pattern]
    if len(pts) < 2: return 'A'
    mins = lambda t: int(t[:2]) * 60 + int(t[3:])
    worked = mins(pts[-1][1]) - mins(pts[0][1]) - KENT_SHIFT['break']
    return 'P' if worked >= KENT_SHIFT['full'] * 60 else 'HD' if worked >= KENT_SHIFT['half'] * 60 else 'A'

def iso_days(a, b):
    d = dt.date.fromisoformat(a)
    while d.isoformat() < b:
        yield d; d += dt.timedelta(days=1)

def K(cid, title, derivation, month, window, plan, settings=None, through=None, backfill=(), unmapped=False):
    """window = attendance window [from, until); through = last punch date (after-cut-off days)."""
    punches, batch2, days = [], [], {}
    last = through or window[1]
    for d in iso_days(window[0], last):
        iso = d.isoformat(); sunday = d.weekday() == 6
        pat = plan.get(iso, 'NONE' if sunday else 'P')
        for dev, hm in PATTERNS[pat]:
            pt_ = f'{iso} {hm}:00'
            rec = (dt.datetime.fromisoformat(f'{iso}T{hm}') + dt.timedelta(minutes=1)).isoformat() + '+05:30'
            item = {'employeeNo': 'SELF', 'deviceId': dev, 'punchTime': pt_, 'direction': 'in' if hm < '13:00' else 'out'}
            if pat == 'LATE':
                batch2.append({**item, 'receivedAt': f'{dt.date.fromisoformat(last).isoformat()}T10:00:00+05:30'})
            else:
                punches.append({**item, 'receivedAt': rec})
                if pat == 'DUP': punches.append({**item, 'receivedAt': rec})
        if iso < window[1]:
            days[iso] = 'WO' if sunday else kstatus(pat)
    # Week close (ATT-09): WO paid when ≥ 1 present day (P/HD/H/OD/CO) in its Mon–Sun week, among window days.
    for iso, code in list(days.items()):
        if code == 'WO':
            sun = dt.date.fromisoformat(iso)
            week = [(sun - dt.timedelta(days=k)).isoformat() for k in range(7)]
            if not any(days.get(w) in ('P', 'HD') for w in week): days[iso] = 'WO:unpaid'
    unpaid = sum({'A': 1, 'HD': 0.5, 'WO:unpaid': 1}.get(c, 0) for c in days.values())
    m0 = dt.date.fromisoformat(month); m1 = (m0.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    div = (m1 - m0).days
    payable = div - unpaid
    unique = len({(p['punchTime'], p['deviceId']) for p in punches})
    c = dict(id=cid, kind='kent', title=title, derivation=derivation, month=month, settings=settings or {}, employee={}, salary=S30,
             shift=KENT_SHIFT, window={'from': window[0], 'until': window[1]}, punches=punches, backfill=batch2, unmappedDevice=unmapped,
             expect=dict(days_in_month=div, payable_days=payable))
    c['expect'].update(payroll(c))
    c['expectDays'] = days
    # After the cut-off: a day gets an (unlocked) record when it has punches, or when the next day's
    # punch dirties it (the engine re-evaluates the previous day for night-shift attribution).
    pat_of = lambda d: plan.get(d.isoformat(), 'NONE' if d.weekday() == 6 else 'P')
    after = {}
    for d in iso_days(window[1], last):
        nxt = d + dt.timedelta(days=1)
        if pat_of(d) != 'NONE' or (nxt.isoformat() < last and pat_of(nxt) != 'NONE'):
            after[d.isoformat()] = 'WO' if d.weekday() == 6 else kstatus(pat_of(d))
    c['expectAfterCutoff'] = after
    c['expectMuster'] = dict(present=sum(v == 'P' for v in days.values()), absent=sum(v == 'A' for v in days.values()),
                             halfDays=sum(v == 'HD' for v in days.values()), weekoffs=sum(v.startswith('WO') for v in days.values()),
                             weekoffsUnpaid=sum(v == 'WO:unpaid' for v in days.values()), lopDays=unpaid)
    c['expectSync'] = dict(firstFetched=len(punches), firstInserted=unique, secondInserted=len(batch2) + 2, thirdInserted=0, unmatched=['KENTHB01'])
    return c

cases += [
 K('K01', 'Kent feed → muster → payroll: calendar month with absences, half day, dedupe and backfill',
   'June 2026 via the simulator: P on two doors 1 Jun; no punch 2 Jun (A); 09:00–14:00 3 Jun (240 min → HD); in-only 4 Jun (A); duplicate delivery 5 Jun (P, deduped); '
   '09:00–12:30 6 Jun (150 min → A); no punches 8–13 Jun (6 A) → Sun 14 Jun forfeited; 16 Jun buffered, arrives in the 2nd sync (P). '
   'LOP = 9 A + 0.5 HD + 1 unpaid WO = 10.5 → 19.5/30; gross 19500; PT 130 (15k–25k)',
   '2026-06-01', ('2026-06-01', '2026-07-01'),
   {'2026-06-01': 'P2', '2026-06-02': 'NONE', '2026-06-03': 'HD', '2026-06-04': 'IN', '2026-06-05': 'DUP', '2026-06-06': 'SHORT',
    **{f'2026-06-{d:02d}': 'NONE' for d in range(8, 14)}, '2026-06-16': 'LATE'}),
 K('K02', 'Kent feed with a 26–25 cycle: only window punches reach payroll',
   'att.cycle_start_day=26, July payroll: window 26 Jun–25 Jul. A 29 Jun + A 14 Jul + HD 20 Jul (09:00–14:00) → LOP 2.5 → 28.5/31. '
   'Punches 26–31 Jul (incl. a missed 28 Jul) are after the cut-off: they stay unlocked and are counted in August',
   '2026-07-01', ('2026-06-26', '2026-07-26'),
   {'2026-06-29': 'NONE', '2026-07-14': 'NONE', '2026-07-20': 'HD', '2026-07-28': 'NONE'}, settings={'att.cycle_start_day': 26}, through='2026-08-01'),
 K('K03', 'Kent door not mapped to a location: absences are held and the month cannot lock until HR maps it',
   'Door G1 has no location: the no-punch day 2 Jun stays held (no day record), the lock is refused (attendance_complete, recompute_drained, sync_watermark). '
   'After HR maps the door the day resolves to A, the month locks and pays 29/30',
   '2026-06-01', ('2026-06-01', '2026-07-01'), {'2026-06-02': 'NONE'}, unmapped=True),
]
for c in cases:
    if c['id'] == 'K03': c['expectBlocked'] = ['attendance_complete', 'recompute_drained', 'sync_watermark']

out = Path(__file__).with_name('scenario-matrix.json')
out.write_text(json.dumps({'generated_by': 'build_matrix.py', 'cases': cases}, indent=1, ensure_ascii=False) + '\n')
print(f'{len(cases)} cases → {out}')
for c in cases:
    if c['kind'] in ('payroll', 'kent'):
        e = c['expect']; print(c['id'], e['payable_days'], '/', e['days_in_month'], 'gross', e['gross'], 'pf', e['PF_EE'], 'esi', e['ESI_EE'], 'pt', e['PT'], 'tds', e['TDS'], 'net', e['net'])
