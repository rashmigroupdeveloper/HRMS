"""June-2026 close inputs: week-off closure, OT approval, loan, holds, 80C declaration, manager approvals and month lock.
Everything through the API (the approver is whoever the workflow routes each step to)."""
import json, os
from qa_api import call, psql, E
HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, '../../payroll/cohort.json')))
ids = {r[0]: int(r[1]) for r in psql('select ecode, id from core.employees')}
users = {r[0]: r[1] for r in psql('select id, email from core.users')}
def approve_all(req_id):
    for _ in range(8):
        st = psql(f"select approver_user_id from wf.request_steps where request_id={req_id} and acted_at is null order by step_no limit 1")
        if not st: return
        call(users[st[0][0]], 'POST', f'/workflows/requests/{req_id}/act', {'action': 'approve', 'comment': 'QA seed'})
# 1. Week-off eligibility for the June weeks (the worker does this every Monday).
for wk in ('2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'):
    print('week-close', wk, call('it_admin', 'POST', '/attendance/week-close', {'weekStart': wk}))
# 2. OT detected on Sat 13-Jun for RGH033901 (4h) -> approved by the routed approver.
for oid, wf in psql("select id, workflow_request_id from att.overtime_entries where status='pending' and work_date between '2026-06-01' and '2026-06-30'"):
    mgr = psql(f"select u.email from att.overtime_entries o join core.users u on u.employee_id=o.manager_id where o.id={oid}")[0][0]
    print('ot', oid, call(mgr, 'POST', '/attendance/ot/decide', {'entryId': int(oid), 'action': 'approve', 'approvedMinutes': 240, 'comment': 'QA seed'}))
# 3. Loans (cohort 'loan'). The loan was sanctioned before June, so it is brought in as an approved legacy loan
#    (the self-service apply path correctly refuses a recovery start in a past month).
for e in C:
    if e.get('loan'):
        L = e['loan']; emi = L['principalRupees'] // L['tenureMonths']
        j = call('payroll', 'POST', '/loans/legacy-import', {'employeeId': ids[e['ecode']], 'loanType': L['loanType'], 'originalPrincipalRupees': L['principalRupees'],
                 'outstandingBalanceRupees': L['principalRupees'], 'annualInterestRate': 0, 'monthlyEmiRupees': emi, 'remainingTenureMonths': L['tenureMonths'],
                 'startMonth': L['startMonth'], 'sourceReference': f"QA sanctioned loan {e['ecode']} May-2026"})
        print('loan', e['ecode'], str(j)[:200])
    # A 'LOAN_EMI' register input is an outstanding legacy salary advance (payroll computes LOAN_EMI; it is not an input).
    for code, amt, note in e['inputs']:
        if code == 'LOAN_EMI':
            j = call('payroll', 'POST', '/loans/legacy-import', {'employeeId': ids[e['ecode']], 'loanType': 'salary_advance', 'originalPrincipalRupees': amt,
                     'outstandingBalanceRupees': amt, 'annualInterestRate': 0, 'monthlyEmiRupees': amt, 'remainingTenureMonths': 1,
                     'startMonth': '2026-06-01', 'sourceReference': f"QA {note} {e['ecode']}"})
            print('loan', e['ecode'], str(j)[:200])
# 4. Salary holds.
for e in C:
    if e.get('hold'):
        print('hold', e['ecode'], call('payroll', 'POST', '/payroll/holds/place', {'employee_id': ids[e['ecode']], 'hold_type': e['hold'], 'reason': f"QA {e['hold']} hold June-2026", 'start_month': '2026-06-01'}))
# 5. Investment declarations (old regime 80C), verified by payroll.
for e in C:
    if e.get('decl80c'):
        body = {'employeeId': ids[e['ecode']], 'financialYear': '2026-27', 'section': '80C', 'declaredAmountPaise': e['decl80c'] * 100}
        try: d = call(E(e['ecode']), 'POST', '/payroll/statutory/declareInvestment', body)  # ESS (handover item 3)
        except RuntimeError: d = call('payroll', 'POST', '/payroll/statutory/declareInvestment', body)  # on behalf (current main)
        did = d.get('id') or (d.get('declaration') or {}).get('id')
        print('decl', e['ecode'], d)
        print('verify', call('payroll', 'POST', '/payroll/statutory/verifyDeclaration', {'declarationId': did, 'verifiedAmountPaise': e['decl80c'] * 100}))
# 6. Policy: manager sign-off is mandatory before the lock (docs/04; the tester set this via PUT /settings too).
print('setting', call('super_admin', 'PUT', '/settings/att.manager_approval_required_for_lock', {'value': True, 'valueType': 'boolean', 'description': 'Managers must approve team attendance before month lock'}))
# Manager sign-off for each team, then the month lock (both companies) after the readiness checklist.
emp_user = {r[0]: r[1] for r in psql('select employee_id, email from core.users where employee_id is not null')}
for co in (1, 2):
    lst = call('hr_head', 'GET', '/attendance/manager-approvals', params={'companyId': co, 'month': '2026-06'})
    rows = lst if isinstance(lst, list) else (lst.get('managers') or lst.get('items') or lst.get('rows') or [])
    for m in rows:
        mid = m.get('managerEmployeeId') or m.get('manager_employee_id') or m.get('employeeId')
        if m.get('approvedAt') or m.get('approved_at'): continue
        print('mgr-approve', co, mid, call(emp_user[str(mid)], 'POST', '/attendance/manager-approvals', {'companyId': co, 'month': '2026-06', 'note': 'June attendance reviewed (QA seed)'}))
for co in (1, 2):
    print('checklist', co, str(call('hr_head', 'GET', '/attendance/month-lock/checklist', params={'companyId': co, 'month': '2026-06'}))[:600])
    print('lock', co, call('hr_head', 'POST', '/attendance/month-lock', {'companyId': co, 'month': '2026-06'}))
