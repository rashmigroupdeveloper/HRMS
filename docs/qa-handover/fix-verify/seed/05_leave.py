"""June-2026 leave for the cohort: RML033924 CL 2-3 Jun, SL 11 Jun, LWP 25 Jun; RML033904 ML 8-30 Jun.
Applied by the employee, approved by whoever the workflow routes each step to."""
import json, os
from qa_api import call, psql, E, tok
HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, '../../payroll/cohort.json')))
# Opening balances: monthly accrual Jan-May 2026 (CL 0.75, SL 0.58, EL 1.25/month), run as the scheduler would.
for m in ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']:
    print('accrual', m, call('it_admin', 'POST', '/leave/accrual/run', {'month': m}))
# Maternity is an event entitlement (26 weeks, Maternity Benefit Act), not accrued: HR grants it on eligibility.
ml = int(psql("select id from core.employees where ecode='RML033904'")[0][0])
call('hr_head', 'POST', '/leave/adjustments', {'employeeId': ml, 'leaveType': 'ML', 'delta': 182, 'note': 'Maternity entitlement 26 weeks (QA seed)'})
users = {r[0]: r[1] for r in psql("select u.id, u.email from core.users u")}
def approve_all(req_id):
    for _ in range(6):
        st = psql(f"select approver_user_id from wf.request_steps where request_id={req_id} and acted_at is null order by step_no limit 1")
        if not st: return
        email = users[st[0][0]]
        call(email, 'POST', f'/workflows/requests/{req_id}/act', {'action': 'approve', 'comment': 'QA seed'})
for e in C:
    for lt, a, b in e.get('att', {}).get('leave', []):
        j = call(E(e['ecode']), 'POST', '/leave/applications', {'leaveType': lt, 'fromDate': a, 'toDate': b, 'reason': f'QA June-2026 {lt}'})
        rid = j.get('workflowRequestId') or (j.get('application') or {}).get('workflow_request_id')
        print(e['ecode'], lt, a, b, 'wf', rid)
        if rid: approve_all(rid)
print(psql("select e.ecode, t.code, a.from_date, a.to_date, a.status from lv.applications a join core.employees e on e.id=a.employee_id join lv.leave_types t on t.id=a.leave_type_id order by 1,3"))
