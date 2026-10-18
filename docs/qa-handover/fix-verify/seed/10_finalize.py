"""Compute → review (payroll) → approve + finalize (hr_head) the June runs, as the tester left them (finalized, not paid)."""
import sys
from qa_api import call
for rid in [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '4,5').split(',')]:
    c = call('payroll', 'POST', '/payroll/runs/compute', {'id': rid})
    call('payroll', 'POST', '/payroll/runs/review', {'id': rid})
    call('hr_head', 'POST', '/payroll/runs/approve', {'id': rid})
    f = call('hr_head', 'POST', '/payroll/runs/finalize', {'id': rid})
    print('run', rid, str(c)[:160], '->', (f.get('status') if isinstance(f, dict) else f))
