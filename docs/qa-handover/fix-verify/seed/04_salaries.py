"""Salary structures + assignments for the June-2026 cohort (from payroll/scripts/s1_salaries.py) and the
pre-existing QA employees (the tester's 'G1 Staff Baseline' and low-wage structures, rebuilt)."""
import json, os
from qa_api import call, psql
HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, '../../payroll/cohort.json')))
ids = {r[0]: int(r[1]) for r in psql('select ecode, id from core.employees')}
def structure(name, co, comp):
    j = call('payroll', 'POST', '/payroll/structures', {'name': name, 'company_id': co, 'description': 'QA payroll structure (exact register amounts)',
             'components': [{'component_code': k, 'formula_override': str(v)} for k, v in comp.items()]})
    return j['id'] if 'id' in j else j['structure']['id']
def assign(eid, sid, eff, ctc, reason, phase=None, pct=None):
    b = {'employee_id': eid, 'structure_id': sid, 'effective_from': eff, 'annual_ctc_rupees': ctc, 'revision_reason': reason}
    if phase: b.update(phase=phase, probation_percent=pct)
    return call('payroll', 'POST', '/payroll/salaries/assign', b)
for e in C:
    co = 1 if e['co'] == 'RML' else 2
    sid = structure(f"QA-PAY-JUN26 {e['ecode']}", co, e['comp'])
    eff = max(e['doj'], '2026-04-01')
    if e['prob']:
        assign(ids[e['ecode']], sid, eff, e['gross'] * 12, 'probation_start', 'probation', e['prob'])
    else:
        assign(ids[e['ecode']], sid, eff, e['gross'] * 12, 'joining' if e['doj'] >= '2026-04-01' else 'correction')
    print('assigned', e['ecode'])
# Pre-existing QA employees (USERS.md): G1 Staff Baseline (gross 64,303) and a low-wage ESIC structure for RML000009.
G1 = {'BASIC': 32286, 'HRA': 16143, 'MEDICAL_ALLOW': 1250, 'STATUTORY_BONUS': 2689, 'SPECIAL_ALLOW': 11935}
LOW = {'BASIC': 9000, 'HRA': 4500, 'SPECIAL_ALLOW': 4936}
g1 = structure('G1 Staff Baseline', 1, G1); g1r = structure('G1 Staff Baseline RGH', 2, G1); low = structure('Low wage (ESIC)', 1, LOW)
for ec in ['RML0000%02d' % i for i in range(1, 11)] + ['RGH000001']:
    sid = low if ec == 'RML000009' else (g1r if ec.startswith('RGH') else g1)
    gross = sum((LOW if ec == 'RML000009' else G1).values())
    assign(ids[ec], sid, '2026-04-01', gross * 12, 'correction')
    print('assigned', ec)
