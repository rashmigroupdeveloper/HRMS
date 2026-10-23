"""Read-only recognition-log evidence; no attendance or payroll writes."""
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
import openpyxl

SOURCE = Path('/Users/anooppratapsingh/Downloads/Kent data.xlsx')
OUT = Path(__file__).resolve().parent
wb = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
sheet = wb['Recognition Logs']
iterator = iter(sheet.values)
headers = next(iterator)
rows = [dict(zip(headers, values), source_row=i) for i, values in enumerate(iterator, 2)]
wb.close()
keys = defaultdict(list)
delays = []
issues = []
device_counts = Counter()
for row in rows:
    event = datetime.strptime(row['Date'] + ' ' + row['Time'], '%d/%m/%Y %H:%M')
    created = datetime.strptime(row['Created on'], '%d-%m-%Y %H:%M')
    minutes = int((created - event).total_seconds() / 60)
    delays.append(minutes)
    code = str(row['Employee ID']).strip().upper()
    device = str(row['Device Name'] or '').strip()
    direction = str(row['Attendance Type'] or '').strip().lower()
    key = (code, event.isoformat(), device)
    keys[key].append(row)
    device_counts[device] += 1
    reasons = []
    if not device: reasons.append('missing source device')
    if minutes >= 24 * 60: reasons.append('created at least 24h after punch')
    if reasons:
        issues.append({'source_row': row['source_row'], 'employee_code': code, 'punch_at_local': event.isoformat(' '),
                       'created_at_local': created.isoformat(' '), 'direction': direction, 'device_name': device,
                       'delay_minutes': minutes, 'reasons': '; '.join(reasons)})
duplicates = []
for (code, at, device), group in keys.items():
    if len(group) <= 1: continue
    duplicates.append({'employee_code': code, 'punch_at_local': at, 'device_name': device,
                       'source_rows': ','.join(str(r['source_row']) for r in group), 'rows': len(group),
                       'directions': ','.join(sorted({str(r['Attendance Type'] or '') for r in group})),
                       'conflicting_directions': len({str(r['Attendance Type'] or '') for r in group}) > 1})

def write(name, records):
    if not records: return
    with (OUT / name).open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)

write('source-review.csv', issues)
write('minute-key-duplicates.csv', duplicates)
write('devices.csv', [{'device_name': k or '(missing)', 'records': v, 'device_id_available': False} for k,v in sorted(device_counts.items())])
date_counts = Counter(datetime.strptime(r['Date'], '%d/%m/%Y').strftime('%Y-%m-%d') for r in rows)
summary = {
 'source': str(SOURCE), 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'sheet': 'Recognition Logs',
 'records': len(rows), 'employees': len({str(r['Employee ID']).strip().upper() for r in rows}),
 'dates': dict(sorted(date_counts.items())), 'directions': dict(Counter(str(r['Attendance Type'] or '(blank)') for r in rows)),
 'blank_device_records': device_counts[''], 'named_devices': sum(bool(k) for k in device_counts),
 'min_created_delay_minutes': min(delays), 'max_created_delay_minutes': max(delays),
 'created_on_later_calendar_date': sum(datetime.strptime(r['Created on'], '%d-%m-%Y %H:%M').date() > datetime.strptime(r['Date'], '%d/%m/%Y').date() for r in rows),
 'created_at_least_24h_later': sum(d >= 1440 for d in delays),
 'duplicate_minute_key_groups': len(duplicates), 'duplicate_minute_key_excess_rows': sum(r['rows'] - 1 for r in duplicates),
 'duplicate_groups_with_direction_conflicts': sum(r['conflicting_directions'] for r in duplicates),
 'source_precision': 'Minute; no seconds supplied', 'can_match_21_22_oct_bookings': False,
 'report_policy': 'Sponsor chooses HRMS finalization no earlier than next-day 04:00 IST; not a KENT finalization promise, forced OUT, attendance-day boundary or completeness proof',
}
(OUT / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
