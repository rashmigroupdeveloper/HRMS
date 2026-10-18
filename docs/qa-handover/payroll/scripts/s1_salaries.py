import json, subprocess
from qa import *
C=json.load(open('/workspace/hrms-test/payroll/cohort.json'))
ids=dict(l.split('|') for l in subprocess.run(['psql','-h','localhost','-U','hrms','-d','hrms','-At','-c',"select ecode,id from core.employees"],capture_output=True,text=True,env={'PGPASSWORD':'hrms_local_dev','PATH':'/usr/bin'}).stdout.split())
json.dump(ids,open('/workspace/hrms-test/payroll/ids.json','w'))
res={}
for e in C:
    eid=int(ids[e['ecode']]); co=1 if e['co']=='RML' else 2
    comps=[{'component_code':k,'formula_override':str(v)} for k,v in e['comp'].items()]
    st,j=call('payroll','POST','/payroll/structures',{'name':f"QA-PAY-JUN26 {e['ecode']}",'company_id':co,'description':'QA payroll test structure (exact register amounts)','components':comps},tag='structure')
    sid=j.get('id') if isinstance(j,dict) else None
    r={'structure':(st,sid)}
    eff=max(e['doj'],'2026-04-01')
    if e['prob']:
        st2,j2=call('payroll','POST','/payroll/salaries/assign',{'employee_id':eid,'structure_id':sid,'effective_from':eff,'annual_ctc_rupees':e['gross']*12,'phase':'probation','probation_percent':e['prob'],'revision_reason':'probation_start'},tag='assign-probation')
        r['probation_assign']=(st2,j2)
        if st2!=200:
            # fallback: a structure carrying the probation-scaled amounts, assigned as a normal revision
            pc={k:round(v*e['prob']/100) for k,v in e['comp'].items()}
            st3,j3=call('payroll','POST','/payroll/structures',{'name':f"QA-PAY-JUN26 {e['ecode']} PROB{e['prob']}",'company_id':co,'components':[{'component_code':k,'formula_override':str(v)} for k,v in pc.items()]},tag='structure-prob')
            sid=j3['id']; r['prob_structure']=(st3,sid); r['prob_comp']=pc
            st2,j2=call('payroll','POST','/payroll/salaries/assign',{'employee_id':eid,'structure_id':sid,'effective_from':eff,'annual_ctc_rupees':sum(pc.values())*12,'revision_reason':'probation_start'},tag='assign-prob-fallback')
            r['assign']=(st2,j2)
    else:
        st2,j2=call('payroll','POST','/payroll/salaries/assign',{'employee_id':eid,'structure_id':sid,'effective_from':eff,'annual_ctc_rupees':e['gross']*12,'revision_reason':'joining' if e['doj']>='2026-04-01' else 'correction'},tag='assign')
        r['assign']=(st2,j2)
    res[e['ecode']]=r
    print(e['ecode'], r['structure'], short(r.get('probation_assign'),200) if e['prob'] else '', r['assign'][0], short(r['assign'][1],150))
# pre-existing QA employees without a salary (1-6,10): G1 baseline structure 2
for eid in (1,2,3,4,5,6,10):
    st,j=call('payroll','POST','/payroll/salaries/assign',{'employee_id':eid,'structure_id':2,'effective_from':'2026-04-01','annual_ctc_rupees':824196,'revision_reason':'correction'},tag='assign-existing')
    print('emp',eid,st,short(j,120)); res[f'emp{eid}']=(st,j)
json.dump(res,open('/workspace/hrms-test/payroll/logs/s1_salaries.json','w'),indent=1,default=str)
