import subprocess, json
from qa import *
q="""select e.id, d::date::text from core.employees e cross join generate_series('2026-06-01'::date,'2026-06-30'::date,'1 day') d
where e.company_id in (1,2) and e.status in ('active','on_notice','exited') and e.doj<='2026-06-30' and (e.dol is null or e.dol>='2026-06-01')
 and d::date>=e.doj and (e.dol is null or d::date<=e.dol)
 and not exists (select 1 from att.day_records r where r.employee_id=e.id and r.work_date=d::date) order by 1,2"""
rows=[l.split('|') for l in subprocess.run(['psql','-h','localhost','-U','hrms','-d','hrms','-At','-c',q],capture_output=True,text=True,env={'PGPASSWORD':'hrms_local_dev','PATH':'/usr/bin'}).stdout.split()]
print('missing day records:',len(rows))
from collections import Counter
c=Counter()
for eid,d in rows:
    st,j=call('it_admin','POST','/attendance/recompute',{'employeeId':int(eid),'date':d},tag='recompute')
    c[(st, json.dumps(j)[:80])]+=1
for k,v in c.most_common(): print(v,k)
