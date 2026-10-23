"""Read-only KENT export reconciliation. Decimal money; no payroll writes."""
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
import openpyxl

OUT = Path(__file__).resolve().parent
DOWNLOADS = Path('/Users/anooppratapsingh/Downloads')
TOKENS = {'canteen': '1792671694077', 'muster': '1792671454354',
          'employee_later': '1792671404475', 'attendance': '1792671340048',
          'employee_earlier': '1792671292075'}
files = {k: next(DOWNLOADS.glob(f'*{token}.xlsx')) for k, token in TOKENS.items()}
raw = {}
for key, path in files.items():
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    raw[key] = list(wb.active.values)
    wb.close()

def records(key, header, start, required):
    names = raw[key][header - 1]
    return [dict(zip(names, row), source_row=i) for i, row in enumerate(raw[key], 1)
            if i >= start and row[required] not in (None, '')]

c = records('canteen', 1, 2, 1)
a = records('attendance', 5, 6, 2)
m = records('muster', 5, 7, 1)
e = records('employee_later', 5, 7, 1)
early = records('employee_earlier', 5, 7, 1)
def code(x): return str(x).strip().upper()
def money(x): return Decimal(str(x))
def write_csv(name, rows, fields=None):
    if not rows: return
    with (OUT / name).open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields or list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

index = defaultdict(list)
for row in a: index[(code(row['Employee ID']), row['Date'])].append(row)
mi = {code(r['Employee ID']): r for r in m}
ei = {code(r['Employee ID']): r for r in e}
joined = []
aggregates = defaultdict(lambda: {'bookings': 0, 'qty': Decimal(0), 'actual': Decimal(0), 'charge': Decimal(0), 'exceptions': 0})
for row in c:
    matches = index[(code(row['Employee Code']), row['Date'])]
    att = matches[0] if len(matches) == 1 else {}
    flags = []
    if len(matches) != 1: flags.append('missing attendance' if not matches else 'ambiguous attendance')
    if att.get('Status') not in ('P', 'HLF'): flags.append('attendance ' + str(att.get('Status', 'unavailable')))
    position = 'no complete interval'
    if att.get('In Time') and att.get('Out Time'):
        booking = datetime.strptime(row['Date'] + ' ' + row['Time of Booking'], '%d/%m/%Y %H:%M:%S')
        at_in = datetime.strptime(row['Date'] + ' ' + att['In Time'], '%d/%m/%Y %H:%M')
        at_out = datetime.strptime(row['Date'] + ' ' + att['Out Time'], '%d/%m/%Y %H:%M')
        if at_out < at_in: at_out += timedelta(days=1)
        position = 'before reported in' if booking < at_in else 'after reported out minute' if booking >= at_out + timedelta(minutes=1) else 'within reported interval'
    if position in ('before reported in', 'after reported out minute'): flags.append(position)
    qty = money(row['Item Qty.'])
    if money(row['Total Actual Price']) != qty * money(row['Actual Price']): flags.append('actual arithmetic mismatch')
    if money(row['Total Item Price']) != qty * money(row['Item Price(Rs.)']): flags.append('charge arithmetic mismatch')
    if att and str(row['Company Name']).strip() != str(att['Company']).strip(): flags.append('company label differs')
    joined.append({'canteen_row': row['source_row'], 'employee_code': code(row['Employee Code']), 'date': row['Date'],
                   'booking_time': row['Time of Booking'], 'meal': row['Type of Food'], 'quantity': str(qty),
                   'reported_actual_rupees': row['Total Actual Price'], 'reported_item_charge_rupees': row['Total Item Price'],
                   'canteen_company': row['Company Name'], 'device_id': row['Device ID'],
                   'attendance_row': att.get('source_row', ''), 'attendance_company': att.get('Company', ''),
                   'attendance_status': att.get('Status', ''), 'reported_in': att.get('In Time', ''),
                   'reported_out': att.get('Out Time', ''), 'interval_comparison': position,
                   'review_reasons': '; '.join(flags)})
    agg = aggregates[code(row['Employee Code'])]
    agg['bookings'] += 1
    agg['qty'] += qty
    agg['actual'] += money(row['Total Actual Price'])
    agg['charge'] += money(row['Total Item Price'])
    agg['exceptions'] += bool(flags)
write_csv('canteen-attendance-match.csv', joined)
write_csv('review-exceptions.csv', [r for r in joined if r['review_reasons']])
write_csv('employee-canteen-review.csv', [dict(employee_code=k, bookings=v['bookings'], quantity=str(v['qty']),
    reported_actual_rupees=str(v['actual']), reported_item_charge_rupees=str(v['charge']),
    implied_difference_rupees=str(v['actual']-v['charge']), rows_for_review=v['exceptions'],
    payroll_status='Review only; recovery basis and settlement not confirmed') for k,v in sorted(aggregates.items())])
diffs = []
for row in a:
    for label, other in [('muster', mi.get(code(row['Employee ID']))), ('employee_later', ei.get(code(row['Employee ID'])))]:
        expected = other.get(str(int(row['Date'][:2]))) if other else None
        if expected != row['Status']:
            diffs.append({'report': label, 'employee_code': row['Employee ID'], 'date': row['Date'],
                          'attendance_row': row['source_row'], 'attendance_status': row['Status'], 'other_status': expected})
write_csv('cross-report-status-differences.csv', diffs)
ei_early = {code(r['Employee ID']): r for r in early}
snapshot_diffs = []
for emp, row in ei.items():
    old = ei_early.get(emp, {})
    for field, val in row.items():
        if field != 'source_row' and old.get(field) != val:
            snapshot_diffs.append({'employee_code': emp, 'field': field, 'earlier': old.get(field), 'later': val})
write_csv('employee-snapshot-differences.csv', snapshot_diffs)
meal = []
for (date, food), count in sorted(Counter((r['Date'], r['Type of Food']) for r in c).items()):
    rows = [r for r in c if r['Date'] == date and r['Type of Food'] == food]
    meal.append({'date': date, 'meal': food, 'bookings': count,
                 'quantity': str(sum((money(r['Item Qty.']) for r in rows), Decimal(0))),
                 'actual_rupees': str(sum((money(r['Total Actual Price']) for r in rows), Decimal(0))),
                 'item_charge_rupees': str(sum((money(r['Total Item Price']) for r in rows), Decimal(0)))})
write_csv('meal-totals.csv', meal)
summary = {
 'files': {k: {'path': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
               'physical_rows': len(raw[k])} for k,p in files.items()},
 'record_counts': {'canteen': len(c), 'attendance': len(a), 'muster': len(m), 'employee_later': len(e), 'employee_earlier': len(early)},
 'unique_employees': {k: len({code(r[field]) for r in rows}) for k,rows,field in [('canteen',c,'Employee Code'),('attendance',a,'Employee ID'),('muster',m,'Employee ID')]},
 'duplicate_attendance_keys': sum(len(v)-1 for v in index.values()),
 'duplicate_muster_codes': len(m)-len(mi),
 'canteen_exact_duplicate_business_rows': len(c)-len({tuple(str(r[k]) for k in raw['canteen'][0] if k != 'Sl.no') for r in c}),
 'meal_totals': meal,
 'canteen_status_counts': dict(Counter(r['attendance_status'] for r in joined)),
 'canteen_interval_counts': dict(Counter(r['interval_comparison'] for r in joined)),
 'canteen_flags': dict(Counter(flag for r in joined for flag in r['review_reasons'].split('; ') if flag)),
 'canteen_dates': dict(Counter(r['Date'] for r in c)),
 'attendance_statuses_by_date': {date: dict(Counter(r['Status'] for r in a if r['Date']==date)) for date in sorted({r['Date'] for r in a})},
 'status_cross_report_differences': len(diffs), 'employee_snapshot_changed_cells': len(snapshot_diffs),
 'employee_snapshot_changed_employees': len({r['employee_code'] for r in snapshot_diffs}),
 'canteen_devices': sorted({(str(r['Device ID']),str(r['Device Name']),str(r['Transaction Location'])) for r in c}),
 'price_combinations': dict(Counter(str((r['Type of Food'],r['Actual Price'],r['Item Price(Rs.)'],r['Item Qty.'])) for r in c)),
 'blank_balance_rows': sum(r['Balance'] in ('',None) for r in c),
 'company_label_pairs': dict(Counter(str((r['canteen_company'],r['attendance_company'])) for r in joined)),
}
(OUT/'summary.json').write_text(json.dumps(summary, indent=2, default=str)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ('files','canteen_devices','company_label_pairs')}, indent=2))
