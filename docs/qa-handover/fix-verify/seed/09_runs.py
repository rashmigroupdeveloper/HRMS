"""Create the June-2026 payroll runs (RML, RGH), enter the cohort's variable inputs and lock inputs.
Prints the run ids (RML first) on the last line as 'RUNS <rml>,<rgh>'."""
import json, os
from qa_api import call, psql
HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, '../../payroll/cohort.json')))
ids = {r[0]: int(r[1]) for r in psql('select ecode, id from core.employees')}
runs = []
# Keep the tester's run ids (RML June = 4, RGH June = 5): docs, the e2e suite and recon refer to them.
if psql('select count(*) from pay.payroll_runs')[0][0] == '0':
    psql('ALTER TABLE pay.payroll_runs ALTER COLUMN id RESTART WITH 4')
for co in (1, 2):
    lock = int(psql(f"select id from att.month_locks where company_id={co} and month='2026-06-01'")[0][0])
    r = call('payroll', 'POST', '/payroll/runs/create', {'company_id': co, 'month': '2026-06-01', 'run_type': 'regular', 'attendance_lock_id': lock, 'notes': 'June 2026 (QA cohort)'})
    rid = r.get('id') or r['run']['id']; runs.append(rid)
    inputs = [{'employeeId': ids[e['ecode']], 'componentCode': code, 'amountRupees': amt, 'note': note}
              for e in C if (e['co'] == 'RML') == (co == 1) for code, amt, note in e['inputs'] if code != 'LOAN_EMI']  # LOAN_EMI comes from the loan (08)
    if inputs: print('inputs', co, str(call('payroll', 'POST', f'/payroll/runs/{rid}/inputs', {'inputs': inputs}))[:200])
    print('lockInputs', co, str(call('payroll', 'POST', '/payroll/runs/lockInputs', {'id': rid}))[:200])
print('RUNS ' + ','.join(map(str, runs)))
