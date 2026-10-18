"""Independent expected-value computation + reconciliation vs app payroll runs 4 (RML) and 5 (RGH), Jun 2026.
Conventions: docs/10 + sample register (PF 12% of ACTUAL earned basic, no ceiling)."""
import json, subprocess, math, csv, io, os
from decimal import Decimal, ROUND_HALF_UP
os.chdir('/workspace/hrms-test/payroll')
ENV = dict(os.environ, PGPASSWORD='hrms_local_dev')
def q(sql):
    out = subprocess.run(['psql','-h','localhost','-U','hrms','-d','hrms','--csv','-c',sql],capture_output=True,text=True,env=ENV,check=True).stdout
    return list(csv.DictReader(io.StringIO(out)))
def r(x): return int(Decimal(str(x)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

cohort = {e['ecode']: e for e in json.load(open('cohort.json'))}
EARN = {'BASIC','HRA','MEDICAL_ALLOW','SPECIAL_ALLOW','EDUCATION_ALLOW','STATUTORY_BONUS','STIPEND','PROJECT_ALLOW'}
EARN_INPUT = {'INCENTIVE','ARREARS','OTHER_EARNINGS'}
items = q("""select i.id item_id, i.run_id, e.id emp_id, e.ecode, e.first_name||' '||e.last_name as name, e.esic_applicable, e.pf_applicable, e.tax_regime,
  l.name loc, e.doj, e.dol, i.days_in_month, i.payable_days, i.lop_days, i.gross, i.total_deductions, i.net_pay, i.payment_status,
  (select component_amounts::text from pay.employee_salaries s where s.employee_id=e.id and s.effective_from<='2026-06-30' and s.effective_to>'2026-06-01' order by effective_from desc limit 1) comp
  from pay.payroll_items i join core.employees e on e.id=i.employee_id left join core.locations l on l.id=e.location_id where i.run_id in (4,5) order by i.run_id, e.ecode""")
lines = {}
for x in q("select item_id, component_code, amount from pay.payroll_item_lines where item_id in (select id from pay.payroll_items where run_id in (4,5))"):
    lines.setdefault(x['item_id'], {})[x['component_code']] = float(x['amount'])
first = {}
for row in open('logs/items_first_compute.tsv'):
    p = row.rstrip('\n').split('\t'); first[p[1]] = {'net': float(p[6]), 'lines': json.loads(p[8])}

# Expected payable days (independent, from the attendance plan + policy)
EXP_DAYS = {'RML033902':28,'RML033904':30,'RML033908':15,'RML033909':20,'RML033910':27,'RML033911':0,'RML033922':7,
            'RML033924':29,'RGH033903':21,'RGH033904':25,'RGH033906':15}
DAYS_NOTE = {'RML033904':'ML 08-30 Jun is paid leave -> 30 (app 7: ML rejected for gender, P-07)',
             'RML033922':'20 absent + 3 Sundays in zero-presence weeks unpaid -> 7','RML033911':'no attendance -> 0',
             'RML033908':'DOJ 16-Jun -> 15','RGH033903':'DOJ 10-Jun -> 21','RML033909':'LWD 20-Jun -> 20','RGH033906':'LWD 15-Jun -> 15',
             'RML033924':'CL2+SL1 paid, LWP1 -> 29','RML033902':'2 absent -> 28','RML033910':'3 absent -> 27','RGH033904':'5 absent -> 25'}
WB_PT = [(10000,0),(15000,110),(25000,130),(40000,150),(10**12,200)]
def pt_wb(g): return next(a for lim,a in WB_PT if g <= lim) if g > 0 else 0
def pt_od(annual, earned): return 0 if earned<=0 else (0 if annual<=160000 else 125 if annual<=300000 else 200)
def tax_new(ti):
    slabs=[(400000,0),(800000,.05),(1200000,.10),(1600000,.15),(2000000,.20),(2400000,.25),(10**12,.30)]
    def base(x):
        t=0; prev=0
        for lim,rate in slabs:
            if x>prev: t+=(min(x,lim)-prev)*rate
            prev=lim
        return t
    t=base(ti)
    if ti<=1200000: t=0
    elif t > ti-1200000: t = ti-1200000          # marginal relief over 87A threshold
    if ti>5000000:
        s=t*.10; t50=base(5000000)
        t=min(t+s, t50+(ti-5000000))             # surcharge marginal relief
    return t*1.04
def tax_old(ti):
    t=0
    for lo,hi,rate in [(250000,500000,.05),(500000,1000000,.20),(1000000,10**12,.30)]:
        if ti>lo: t+=(min(ti,hi)-lo)*rate
    if ti<=500000: t=0
    return t*1.04

rows=[]
for it in items:
    ec=it['ecode']; c=cohort.get(ec); comp={k:v/100 for k,v in json.loads(it['comp'] or '{}').items() if k in EARN}
    dim=30; pd=EXP_DAYS.get(ec,30); appr = c and c.get('contract')=='apprentice'
    hold = c and c.get('hold')=='process' or ec=='RML033922'   # Kaushik process-held after negative-net finalize block (workaround)
    exp={}
    if hold: pd=float(it['payable_days'])
    if not hold:
        for k,v in comp.items(): exp[k]=r(v*pd/dim) if not (appr and k=='STATUTORY_BONUS') else 0
        for code,amt,_ in (c['inputs'] if c else []):
            exp[code]=exp.get(code,0)+amt
        if ec=='RGH033901': exp['OT']=r(comp['BASIC']/208*2*4)
        if c and c.get('loan'): exp['LOAN_EMI']=exp.get('LOAN_EMI',0)+c['loan']['principalRupees']//c['loan']['tenureMonths']
    gross=sum(v for k,v in exp.items() if k in EARN|EARN_INPUT|{'OT'})
    basic=exp.get('BASIC',0); full_gross=sum(comp.values())
    esic = (c['esic'] if c else it['esic_applicable']=='t') and not appr
    pfon = not appr and it['pf_applicable']=='t'
    if not hold:
        exp['PF_EE']=r(basic*.12) if pfon else 0
        exp['ESI_EE']=math.ceil(round(gross*.0075,6)) if esic and full_gross<=21000 and gross>0 else 0
        exp['PT']=pt_od(full_gross*12,gross) if it['loc']=='Bhubaneswar Office' else pt_wb(gross)
        regime=(c or {}).get('regime') or it['tax_regime']
        annual=full_gross*12
        if regime=='old': ti=annual-50000-150000-exp['PT']*12; tds=tax_old(ti)
        else: ti=annual-75000; tds=tax_new(ti)
        exp['TDS']=r(tds/12) if pd>=dim and not appr else 0
        exp['EMP_PF_ER']=r(basic*.0367) if pfon else 0; exp['EMP_EPS']=r(min(basic,15000)*.0833) if pfon else 0
        exp['EMP_EDLI']=r(min(basic,15000)*.005) if pfon else 0; exp['EMP_ESI_ER']=math.ceil(round(gross*.0325,6)) if exp['ESI_EE'] else 0
    ded=sum(v for k,v in exp.items() if k not in EARN|EARN_INPUT|{'OT'} and not k.startswith('EMP_'))
    L=lines.get(it['item_id'],{})
    a_gross=float(it['gross']); a_ded=float(it['total_deductions']); a_net=float(it['net_pay'])
    other_codes={'CANTEEN','LOAN_EMI','GUEST_HOUSE','TRAVEL_ADV_RECOVERY','MISC_RECOVERY','NOTICE_RECOVERY','LWF_EE'}
    rec={'run':it['run_id'],'ecode':ec,'name':it['name'],'mock':bool(c),'case':(c or {}).get('case','pre-existing seed employee (not part of mock cohort)'),
         'exp_days':pd,'app_days':float(it['payable_days']),'days_note':('PROCESS HOLD: zero item expected; days not compared' if hold else DAYS_NOTE.get(ec,'')),
         'exp_gross':gross,'app_gross':a_gross,'exp_pf':exp.get('PF_EE',0),'app_pf':L.get('PF_EE',0),'exp_esi':exp.get('ESI_EE',0),'app_esi':L.get('ESI_EE',0),
         'exp_pt':exp.get('PT',0),'app_pt':L.get('PT',0),'exp_tds':exp.get('TDS',0),'app_tds':L.get('TDS',0),
         'exp_other':sum(exp.get(k,0) for k in other_codes),'app_other':sum(L.get(k,0) for k in other_codes),
         'exp_ded':ded,'app_ded':a_ded,'exp_net':gross-ded,'app_net':a_net,'payment_status':it['payment_status'],
         'exp_er':{k:v for k,v in exp.items() if k.startswith('EMP_')},'app_lines':L,'exp_lines':exp,
         'first_compute_net':first.get(ec,{}).get('net')}
    diffs=[]
    for f in ('days','gross','pf','esi','pt','tds','other','ded','net'):
        d=round(rec['app_'+f]-rec['exp_'+f],2)
        rec['d_'+f]=d
        if abs(d)>=1: diffs.append(f)
        elif abs(d)>0: diffs.append(f+'~rounding')
    rec['mismatch_fields']=diffs
    rec['status']='MATCH' if not diffs else ('ROUNDING (<Rs1)' if all('~' in x for x in diffs) else 'MISMATCH')
    rows.append(rec)
json.dump(rows,open('logs/reconciliation.json','w'),indent=1,default=str)
for x in rows:
    print(f"{x['run']} {x['ecode']:10} {x['status']:16} days {x['exp_days']}/{x['app_days']} gross {x['exp_gross']}/{x['app_gross']} pf {x['exp_pf']}/{x['app_pf']} esi {x['exp_esi']}/{x['app_esi']} pt {x['exp_pt']}/{x['app_pt']} tds {x['exp_tds']}/{x['app_tds']} oth {x['exp_other']}/{x['app_other']} net {x['exp_net']}/{x['app_net']}  {','.join(f for f in x['mismatch_fields'] if '~' not in f)}")
from collections import Counter
print(Counter(x['status'] for x in rows), Counter(x['status'] for x in rows if x['mock']))
print('field mismatch counts', Counter(f for x in rows for f in x['mismatch_fields'] if '~' not in f))
